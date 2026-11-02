import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Video,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { dataStore } from '../services/dataStore';
import { CalendarEvent, CalendarEventType } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { addDaysToLocalDateISO, getLocalDateISO } from '../utils/dates';

interface CalendarProps {
  onNavigate?: (page: string, prompt?: string, params?: Record<string, any>) => void;
}

export const Calendar: React.FC<CalendarProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'agenda'>('month');

  // Dynamic Month & Year Navigation
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string>(() => getLocalDateISO());
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const [eventDate, setEventDate] = useState(addDaysToLocalDateISO(1));
  const [startTime, setStartTime] = useState('14:00');
  const [duration, setDuration] = useState(60);
  const [eventType, setEventType] = useState<CalendarEventType>('reuniao');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const clients = dataStore.getClients();

  const refresh = () => setEvents(dataStore.getCalendarEvents());

  useEffect(() => {
    refresh();
    const unsub = dataStore.subscribe(refresh);
    return unsub;
  }, []);

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const todayStr = getLocalDateISO(today);
    setSelectedDay(todayStr);
    setEventDate(todayStr);
  };

  // Conflict detection in real-time
  const currentConflict = useMemo(() => {
    if (!eventDate || !startTime) return { hasConflict: false };
    return dataStore.checkCalendarConflict(
      eventDate,
      startTime,
      Number(duration) || 60,
      editingEvent ? editingEvent.id : undefined
    );
  }, [eventDate, startTime, duration, editingEvent, events]);

  // Form submit (Create or Update)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate || !startTime) {
      showToast('Preencha os campos obrigatórios (*)', 'warning');
      return;
    }
    if (currentConflict.hasConflict) {
      showToast(`O horário conflita com "${currentConflict.conflictingEvent?.title}". Escolha outro horário.`, 'warning');
      return;
    }

    let finalClientId: string | undefined = clientId || undefined;
    if (!finalClientId && clientName.trim()) {
      const client = dataStore.findClientByName(clientName.trim());
      if (client) finalClientId = client.id;
    }

    if (editingEvent) {
      dataStore.updateCalendarEvent(editingEvent.id, {
        title: title.trim(),
        client_name: clientName.trim() || undefined,
        client_id: finalClientId,
        event_date: eventDate,
        start_time: startTime,
        duration_minutes: Number(duration) || 60,
        event_type: eventType,
        location: location.trim() || undefined,
        description: description.trim(),
      });
      showToast(`Compromisso "${title}" atualizado com sucesso!`, 'success');
      setEditingEvent(null);
    } else {
      dataStore.createCalendarEvent({
        title: title.trim(),
        client_name: clientName.trim() || undefined,
        client_id: finalClientId,
        event_date: eventDate,
        start_time: startTime,
        duration_minutes: Number(duration) || 60,
        event_type: eventType,
        location: location.trim() || undefined,
        description: description.trim(),
        status: 'agendado',
        user_id: user?.id || dataStore.getUser().id,
        user_name: user?.name || 'Usuário',
      });
      showToast(`Compromisso "${title}" agendado com sucesso!`, 'success');
      setIsCreateModalOpen(false);
    }

    // Reset fields
    setTitle('');
    setClientName('');
    setClientId('');
    setDescription('');
  };

  const openCreateModalForDate = (dateStr: string) => {
    setSelectedDay(dateStr);
    setEventDate(dateStr);
    setEditingEvent(null);
    setTitle('');
    setClientName('');
    setClientId('');
    setStartTime('10:00');
    setDuration(60);
    setDescription('');
    setIsCreateModalOpen(true);
  };

  const openEditModal = (evt: CalendarEvent) => {
    setEditingEvent(evt);
    setTitle(evt.title);
    setClientName(evt.client_name || '');
    setClientId(evt.client_id || '');
    setEventDate(evt.event_date);
    setStartTime(evt.start_time);
    setDuration(evt.duration_minutes || 60);
    setEventType(evt.event_type);
    setLocation(evt.location || '');
    setDescription(evt.description || '');
  };

  const handleCancelEvent = (id: string, eventTitle: string) => {
    if (confirm(`Deseja realmente cancelar o compromisso "${eventTitle}"?`)) {
      dataStore.cancelCalendarEvent(id);
      showToast('Compromisso cancelado na agenda.', 'info');
    }
  };

  const handleToggleComplete = (evt: CalendarEvent) => {
    const newStatus = evt.status === 'concluido' ? 'agendado' : 'concluido';
    dataStore.updateCalendarEvent(evt.id, { status: newStatus });
    showToast(`Compromisso marcado como ${newStatus === 'concluido' ? 'concluído' : 'agendado'}!`, 'success');
  };

  // Month grid generation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const currentMonthName = monthNames[month];

  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday

  const monthGridDays = useMemo(() => {
    const list = [];
    const padMonth = String(month + 1).padStart(2, '0');

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const padDay = String(day).padStart(2, '0');
      const dateStr = `${year}-${padMonth}-${padDay}`;
      const dayEvents = events.filter((e) => e.event_date === dateStr && e.status !== 'cancelado');
      list.push({
        day,
        dateStr,
        events: dayEvents,
      });
    }
    return list;
  }, [year, month, totalDaysInMonth, events]);

  const getEventBadgeColor = (type: CalendarEventType) => {
    switch (type) {
      case 'reuniao':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'ligacao':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'tarefa':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'compromisso':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      default:
        return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-brand-500" />
            <span>Agenda & Compromissos</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gerencie reuniões presenciais, videochamadas e compromissos com prevenção de conflitos
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl text-xs font-semibold">
            {(['month', 'week', 'day', 'agenda'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 capitalize rounded-lg transition-all ${
                  viewMode === mode
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : mode === 'day' ? 'Dia' : 'Lista'}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Month Navigator Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              {currentMonthName} de {year}
            </h2>
            <span className="text-[11px] text-slate-400">
              {events.filter((e) => e.status !== 'cancelado').length} compromissos no sistema
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400 text-slate-700 dark:text-slate-200 transition-colors border border-transparent hover:border-brand-500/20"
          >
            Hoje (18/09)
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Month Grid View */}
      {viewMode === 'month' && (
        <Card className="p-4 space-y-2">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 uppercase py-2">
            <div className="text-rose-500/80">Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div className="text-slate-500">Sáb</div>
          </div>

          {/* Grid Slots */}
          <div className="grid grid-cols-7 gap-2">
            {/* Offset empty slots for the start of the month */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[6.5rem] rounded-xl bg-slate-50/30 dark:bg-slate-900/20 border border-dashed border-slate-200/40 dark:border-slate-800/40 opacity-30"
              />
            ))}

            {/* Days in Month */}
            {monthGridDays.map((item) => {
              const isToday = item.dateStr === getLocalDateISO();
              const isSelected = item.dateStr === selectedDay;

              return (
                <div
                  key={item.day}
                  onClick={() => setSelectedDay(item.dateStr)}
                  onDoubleClick={() => openCreateModalForDate(item.dateStr)}
                  className={`min-h-[6.5rem] rounded-2xl p-2 transition-all cursor-pointer border overflow-hidden flex flex-col justify-between ${
                    isToday
                      ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-950/20 shadow-xs'
                      : isSelected
                      ? 'border-slate-400 dark:border-slate-600 bg-slate-100/60 dark:bg-slate-800/40'
                      : 'border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#111827] hover:border-brand-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday
                          ? 'w-6 h-6 rounded-full bg-brand-500 text-slate-900 flex items-center justify-center shadow-xs'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.day}
                    </span>
                    {item.events.length > 0 && (
                      <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                        {item.events.length}
                      </span>
                    )}
                  </div>

                  {/* Micro event pills */}
                  <div className="space-y-1 overflow-hidden mt-1">
                    {item.events.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(ev);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded-lg truncate border font-medium cursor-pointer hover:opacity-80 transition-opacity ${getEventBadgeColor(
                          ev.event_type
                        )} ${ev.status === 'concluido' ? 'opacity-50 line-through' : ''}`}
                        title={`${ev.start_time} - ${ev.title} (${ev.client_name || 'Sem cliente'})`}
                      >
                        {ev.start_time} {ev.title}
                      </div>
                    ))}
                    {item.events.length > 2 && (
                      <span className="text-[9px] text-slate-400 font-bold block text-center">
                        +{item.events.length - 2} mais
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Agenda & List View */}
      {(viewMode === 'agenda' || viewMode === 'day' || viewMode === 'week') && (
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          <div className="pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {viewMode === 'day' ? `Compromissos do Dia (${selectedDay})` : 'Todos os Compromissos Agendados'}
            </h3>
            <span className="text-xs text-slate-400">
              {events.filter((e) => e.status !== 'cancelado').length} registros
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 pt-2">
            {events
              .filter((e) => e.status !== 'cancelado' && (viewMode !== 'day' || e.event_date === selectedDay))
              .map((evt) => (
                <div key={evt.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="text-center px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 min-w-[70px]">
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">
                        {evt.start_time}
                      </span>
                      <span className="block text-[10px] text-slate-400 uppercase">
                        {evt.event_date}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`text-sm font-bold text-slate-900 dark:text-white ${evt.status === 'concluido' ? 'line-through opacity-60' : ''}`}>
                          {evt.title}
                        </h4>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getEventBadgeColor(evt.event_type)}`}>
                          {evt.event_type}
                        </span>
                        {evt.status === 'concluido' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Concluído
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                        {evt.client_name && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cid = evt.client_id || dataStore.findClientByName(evt.client_name!)?.id;
                              if (cid && onNavigate) {
                                onNavigate('clients', undefined, { clientId: cid });
                              }
                            }}
                            className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 hover:text-brand-500 transition-colors group cursor-pointer"
                            title="Ver visão 360° do Cliente"
                          >
                            <Users className="w-3.5 h-3.5 text-brand-500 group-hover:scale-110 transition-transform" />
                            <span>{evt.client_name}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-brand-500 transition-opacity" />
                          </button>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {evt.location || 'Local não informado'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {evt.duration_minutes} min
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleToggleComplete(evt)}
                      className={`p-2 rounded-xl transition-colors ${
                        evt.status === 'concluido'
                          ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                          : 'text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={evt.status === 'concluido' ? 'Reabrir compromisso' : 'Marcar como concluído'}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(evt)}
                      className="p-2 text-slate-400 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                      title="Editar compromisso"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCancelEvent(evt.id, evt.title)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                      title="Cancelar compromisso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Modal: Criar ou Editar Compromisso */}
      <Modal
        isOpen={isCreateModalOpen || !!editingEvent}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingEvent(null);
        }}
        title={editingEvent ? 'Editar Compromisso' : 'Novo Compromisso'}
        subtitle="Agendamento inteligente conectado ao sistema e com validação anti-conflito"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Conflict Warning Callout */}
          {currentConflict.hasConflict && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
              <span>
                <strong>Atenção:</strong> Há sobreposição de horário com "
                {currentConflict.conflictingEvent?.title}" (
                {currentConflict.conflictingEvent?.start_time}).
              </span>
            </div>
          )}

          <Input
            label="Título do Compromisso *"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Revisão mensal"
          />

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Cliente Vinculado (Opcional)
            </label>
            <select
              value={clientId}
              onChange={(e) => {
                const id = e.target.value;
                setClientId(id);
                const sel = clients.find((c) => c.id === id);
                if (sel) {
                  setClientName(sel.name);
                } else {
                  setClientName('');
                }
              }}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="">Nenhum / Compromisso Interno</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company_name ? `(${c.company_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Data *"
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
            <Input
              label="Horário de Início *"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Tipo de Evento
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="reuniao">Reunião</option>
                <option value="ligacao">Ligação / Call</option>
                <option value="tarefa">Tarefa Operacional</option>
                <option value="compromisso">Compromisso Externo</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <Input
              label="Duração (minutos)"
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              placeholder="60"
            />
          </div>

          <Input
            label="Local / Link da Chamada"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Google Meet, Zoom ou Endereço físico"
          />

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Pauta / Observações
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Assuntos e tópicos a serem abordados..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingEvent(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {editingEvent ? 'Salvar Alterações' : 'Agendar Compromisso'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
