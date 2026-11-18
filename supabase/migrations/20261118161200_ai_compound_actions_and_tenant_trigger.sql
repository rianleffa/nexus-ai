-- Preserve tenant validation without touching fields absent from a table.
CREATE OR REPLACE FUNCTION public.validate_tenant_relations()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r jsonb := to_jsonb(NEW);
BEGIN
 IF nullif(r->>'client_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=(r->>'client_id')::uuid AND c.company_id=NEW.company_id) THEN
  RAISE EXCEPTION 'The client must belong to the same company.';
 END IF;
 IF TG_TABLE_NAME='tasks' THEN
  IF NEW.project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=NEW.project_id AND p.company_id=NEW.company_id) THEN RAISE EXCEPTION 'The project must belong to the same company.'; END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=NEW.assigned_to AND u.company_id=NEW.company_id) THEN RAISE EXCEPTION 'The task assignee must belong to the same company.'; END IF;
 END IF;
 IF TG_TABLE_NAME='projects' THEN
  IF NEW.lead_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=NEW.lead_user_id AND u.company_id=NEW.company_id) THEN RAISE EXCEPTION 'The project owner must belong to the same company.'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_company_normalized_name ON public.clients(company_id,lower(btrim(name)));

-- Called only after the owner confirms a pending, short-lived action.
-- Invoker privileges and existing RLS remain in force for every read and write.
CREATE OR REPLACE FUNCTION public.confirm_client_meeting(p_log_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
 actor uuid := auth.uid(); tenant uuid; action public.ai_action_logs%rowtype;
 a jsonb; client_row public.clients%rowtype; event_row public.calendar_events%rowtype;
 client_name text; event_title text; event_date date; event_time text; matches integer;
 created_client boolean := false; output jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para confirmar.' USING ERRCODE='42501'; END IF;
 SELECT company_id INTO tenant FROM public.profiles WHERE user_id=actor AND status='ativo';
 IF tenant IS NULL THEN RAISE EXCEPTION 'Perfil empresarial indisponível.' USING ERRCODE='42501'; END IF;
 SELECT * INTO action FROM public.ai_action_logs WHERE id=p_log_id AND user_id=actor AND company_id=tenant AND tool_name='create_client_and_meeting' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Confirmação não encontrada para este usuário.' USING ERRCODE='42501'; END IF;
 IF action.status='success' THEN RETURN action.result; END IF;
 IF action.status<>'pending_confirmation' OR action.created_at < now()-interval '5 minutes' THEN RAISE EXCEPTION 'A confirmação expirou ou já foi cancelada.'; END IF;
 a := action.parameters;
 client_name := btrim(a->>'name'); event_title := btrim(a->>'title'); event_time := a->>'start_time';
 IF client_name IS NULL OR length(client_name)=0 OR length(client_name)>255 OR event_title IS NULL OR length(event_title)=0 OR length(event_title)>255
 OR coalesce(a->>'event_date','') !~ '^\d{4}-\d{2}-\d{2}$' OR coalesce(event_time,'') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
  RAISE EXCEPTION 'Informe nome, título, data e horário válidos.';
 END IF;
 event_date := (a->>'event_date')::date;
 -- Serialize equivalent client creations without imposing uniqueness on legacy records.
 PERFORM pg_advisory_xact_lock(hashtextextended(tenant::text||':'||lower(client_name),0));
 SELECT count(*) INTO matches FROM public.clients WHERE company_id=tenant AND lower(btrim(name))=lower(client_name);
 IF matches>1 THEN RAISE EXCEPTION 'Há clientes com o mesmo nome. Informe o cadastro exato.'; END IF;
 SELECT * INTO client_row FROM public.clients WHERE company_id=tenant AND lower(btrim(name))=lower(client_name) LIMIT 1;
 IF nullif(a->>'existing_client_id','') IS NOT NULL AND (client_row.id IS NULL OR client_row.id<>(a->>'existing_client_id')::uuid) THEN
  RAISE EXCEPTION 'O cliente mudou após a preparação. Solicite uma nova confirmação.';
 END IF;
 IF client_row.id IS NULL THEN
  INSERT INTO public.clients(company_id,user_id,name,email,phone,status)
  VALUES(tenant,actor,client_name,nullif(a->>'email',''),nullif(a->>'phone',''),'ativo') RETURNING * INTO client_row;
  created_client := true;
 END IF;
 INSERT INTO public.calendar_events(company_id,user_id,client_id,title,description,event_type,event_date,start_time,duration_minutes,status)
 VALUES(tenant,actor,client_row.id,event_title,coalesce(a->>'description',''),'reuniao',event_date,event_time,60,'agendado') RETURNING * INTO event_row;
 output := jsonb_build_object('client',jsonb_build_object('id',client_row.id,'name',client_row.name,'created',created_client),'event',jsonb_build_object('id',event_row.id,'title',event_row.title,'event_date',event_row.event_date,'start_time',event_row.start_time,'client_id',event_row.client_id));
 UPDATE public.ai_action_logs SET status='success',result=output,error_message=null WHERE id=action.id;
 RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.confirm_client_meeting(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_client_meeting(uuid) TO authenticated;
