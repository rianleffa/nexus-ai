import assert from 'node:assert/strict';
import test from 'node:test';
import { clientWhatsAppUrl, getPersonType, maskDocument, maskPhone, validateClientContact } from './clientContact.ts';
import { calculateProjectProgress } from './projectProgress.ts';

test('applies Brazilian masks and rejects incomplete contact fields', () => {
  assert.equal(maskDocument('52998224725', 'individual'), '529.982.247-25');
  assert.equal(maskDocument('11222333000181', 'company'), '11.222.333/0001-81');
  assert.equal(getPersonType('11.222.333/0001-81'), 'company');
  assert.equal(maskPhone('11987654321'), '(11) 98765-4321');
  assert.equal(maskPhone('1134567890'), '(11) 3456-7890');
  assert.equal(clientWhatsAppUrl('+55 (11) 98765-4321'), 'https://wa.me/5511987654321');
  assert.equal(clientWhatsAppUrl('123'), undefined);
  assert.equal(validateClientContact('529.982.247-25', '(11) 98765-4321', 'individual'), undefined);
  assert.ok(validateClientContact('529.982', '', 'individual'));
  assert.ok(validateClientContact('000.000.000-00', '', 'individual'));
  assert.ok(validateClientContact('', '123', 'individual'));
});

test('progress follows task completion, reopening and deletion within the same company', () => {
  const first = { project_id: 'p', company_id: 'a', status: 'a_fazer' };
  const second = { ...first, status: 'concluido' };
  const other = { ...first, company_id: 'b' };
  const result = (...tasks) => calculateProjectProgress(tasks, 'a').get('p') ?? 0;
  assert.equal(result(first, second, other), 50);
  assert.equal(result({ ...first, status: 'concluido' }, second, other), 100);
  assert.equal(result(first, second, other), 50);
  assert.equal(result(second, other), 100);
  assert.equal(result(other), 0);
});
