-- Seed oficial de QA/demo para a versão vendável.
-- Objetivo: deixar um ambiente local reproduzível para demo sem ajustes manuais.

-- Organização
DO $$
BEGIN
  INSERT INTO public.organizations (id, name, slug, created_at, updated_at)
  VALUES (
    '77777777-7777-7777-7777-777777777777',
    'QA Realty',
    'demo-vivacrm',
    NOW() - INTERVAL '10 days',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    updated_at = NOW();
END
$$;

-- Usuários de autenticação
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  email_change,
  phone_change,
  phone_change_token,
  reauthentication_token,
  role,
  instance_id,
  aud,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '92b7f3e1-4038-48b4-90e4-2de895a0dc5d',
    'qa@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'authenticated',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "QA Tester", "organization_name": "QA Realty"}'::jsonb,
    NOW() - INTERVAL '10 days',
    NOW()
  ),
  (
    'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
    'broker.demo@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'authenticated',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name": "Broker Demo", "organization_name": "QA Realty"}'::jsonb,
    NOW() - INTERVAL '9 days',
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  confirmation_token = EXCLUDED.confirmation_token,
  recovery_token = EXCLUDED.recovery_token,
  email_change_token_new = EXCLUDED.email_change_token_new,
  email_change_token_current = EXCLUDED.email_change_token_current,
  email_change = EXCLUDED.email_change,
  phone_change = EXCLUDED.phone_change,
  phone_change_token = EXCLUDED.phone_change_token,
  reauthentication_token = EXCLUDED.reauthentication_token,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  email_confirmed_at = NOW(),
  updated_at = NOW();

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES
  (
    '92b7f3e1-4038-48b4-90e4-2de895a0dc5d',
    '92b7f3e1-4038-48b4-90e4-2de895a0dc5d',
    '{"sub":"92b7f3e1-4038-48b4-90e4-2de895a0dc5d","email":"qa@example.com","email_verified":true}'::jsonb,
    'email',
    'qa@example.com',
    NOW(),
    NOW() - INTERVAL '10 days',
    NOW()
  ),
  (
    'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
    'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
    '{"sub":"b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c","email":"broker.demo@example.com","email_verified":true}'::jsonb,
    'email',
    'broker.demo@example.com',
    NOW(),
    NOW() - INTERVAL '9 days',
    NOW()
  )
ON CONFLICT (provider_id, provider) DO UPDATE
SET
  identity_data = EXCLUDED.identity_data,
  last_sign_in_at = EXCLUDED.last_sign_in_at,
  updated_at = EXCLUDED.updated_at;

-- Perfis
INSERT INTO public.profiles (
  id,
  organization_id,
  full_name,
  role,
  is_active,
  created_at,
  updated_at
)
VALUES
  (
    '92b7f3e1-4038-48b4-90e4-2de895a0dc5d',
    '77777777-7777-7777-7777-777777777777',
    'QA Tester',
    'owner',
    TRUE,
    NOW() - INTERVAL '10 days',
    NOW()
  ),
  (
    'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
    '77777777-7777-7777-7777-777777777777',
    'Broker Demo',
    'broker',
    TRUE,
    NOW() - INTERVAL '9 days',
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  organization_id = EXCLUDED.organization_id,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Configuração do site público
INSERT INTO public.site_settings (
  organization_id,
  theme,
  brand_name,
  primary_color,
  secondary_color,
  whatsapp,
  phone,
  email,
  onboarding_collapsed,
  whatsapp_onboarding_collapsed,
  created_at,
  updated_at
)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  'search_first',
  'QA Realty',
  '#0f766e',
  '#0f172a',
  '+55 11 99999-0000',
  '+55 11 3333-0000',
  'contato@qarealty.example',
  TRUE,
  TRUE,
  NOW() - INTERVAL '8 days',
  NOW()
)
ON CONFLICT (organization_id) DO UPDATE
SET
  theme = EXCLUDED.theme,
  brand_name = EXCLUDED.brand_name,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  whatsapp = EXCLUDED.whatsapp,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  onboarding_collapsed = EXCLUDED.onboarding_collapsed,
  whatsapp_onboarding_collapsed = EXCLUDED.whatsapp_onboarding_collapsed,
  updated_at = NOW();

-- Configuração de distribuição
INSERT INTO public.lead_distribution_settings (
  organization_id,
  enabled,
  mode,
  sla_minutes,
  redistribute_overdue,
  created_at,
  updated_at
)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  TRUE,
  'round_robin',
  15,
  TRUE,
  NOW() - INTERVAL '8 days',
  NOW()
)
ON CONFLICT (organization_id) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  mode = EXCLUDED.mode,
  sla_minutes = EXCLUDED.sla_minutes,
  redistribute_overdue = EXCLUDED.redistribute_overdue,
  updated_at = NOW();

INSERT INTO public.lead_distribution_state (
  organization_id,
  last_assigned_profile_id,
  updated_at
)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
  NOW()
)
ON CONFLICT (organization_id) DO UPDATE
SET
  last_assigned_profile_id = EXCLUDED.last_assigned_profile_id,
  updated_at = NOW();

-- Limpeza de leads criados em smoke tests para manter a base de apresentação enxuta.
DELETE FROM public.ai_lead_messages
WHERE session_id IN (
  SELECT id FROM public.ai_lead_sessions
  WHERE contact_id IN (
    SELECT id FROM public.contacts
    WHERE organization_id = '77777777-7777-7777-7777-777777777777'
      AND (
        name ILIKE 'Lead Smoke %'
        OR name ILIKE 'Lead Browser %'
        OR email ILIKE 'lead.smoke.%@example.com'
        OR email ILIKE 'lead.browser.%@example.com'
        OR email ILIKE 'qa-lead-%@example.com'
      )
  )
);

DELETE FROM public.ai_lead_qualifications
WHERE session_id IN (
  SELECT id FROM public.ai_lead_sessions
  WHERE contact_id IN (
    SELECT id FROM public.contacts
    WHERE organization_id = '77777777-7777-7777-7777-777777777777'
      AND (
        name ILIKE 'Lead Smoke %'
        OR name ILIKE 'Lead Browser %'
        OR email ILIKE 'lead.smoke.%@example.com'
        OR email ILIKE 'lead.browser.%@example.com'
        OR email ILIKE 'qa-lead-%@example.com'
      )
  )
);

DELETE FROM public.ai_lead_sessions
WHERE contact_id IN (
  SELECT id FROM public.contacts
  WHERE organization_id = '77777777-7777-7777-7777-777777777777'
    AND (
      name ILIKE 'Lead Smoke %'
      OR name ILIKE 'Lead Browser %'
      OR email ILIKE 'lead.smoke.%@example.com'
      OR email ILIKE 'lead.browser.%@example.com'
      OR email ILIKE 'qa-lead-%@example.com'
    )
);

DELETE FROM public.followup_jobs
WHERE contact_id IN (
  SELECT id FROM public.contacts
  WHERE organization_id = '77777777-7777-7777-7777-777777777777'
    AND (
      name ILIKE 'Lead Smoke %'
      OR name ILIKE 'Lead Browser %'
      OR email ILIKE 'lead.smoke.%@example.com'
      OR email ILIKE 'lead.browser.%@example.com'
      OR email ILIKE 'qa-lead-%@example.com'
    )
);

DELETE FROM public.messages
WHERE contact_id IN (
  SELECT id FROM public.contacts
  WHERE organization_id = '77777777-7777-7777-7777-777777777777'
    AND (
      name ILIKE 'Lead Smoke %'
      OR name ILIKE 'Lead Browser %'
      OR email ILIKE 'lead.smoke.%@example.com'
      OR email ILIKE 'lead.browser.%@example.com'
      OR email ILIKE 'qa-lead-%@example.com'
    )
);

DELETE FROM public.contact_events
WHERE contact_id IN (
  SELECT id FROM public.contacts
  WHERE organization_id = '77777777-7777-7777-7777-777777777777'
    AND (
      name ILIKE 'Lead Smoke %'
      OR name ILIKE 'Lead Browser %'
      OR email ILIKE 'lead.smoke.%@example.com'
      OR email ILIKE 'lead.browser.%@example.com'
      OR email ILIKE 'qa-lead-%@example.com'
    )
);

DELETE FROM public.contact_interactions
WHERE contact_id IN (
  SELECT id FROM public.contacts
  WHERE organization_id = '77777777-7777-7777-7777-777777777777'
    AND (
      name ILIKE 'Lead Smoke %'
      OR name ILIKE 'Lead Browser %'
      OR email ILIKE 'lead.smoke.%@example.com'
      OR email ILIKE 'lead.browser.%@example.com'
      OR email ILIKE 'qa-lead-%@example.com'
    )
);

DELETE FROM public.appointments
WHERE contact_id IN (
  SELECT id FROM public.contacts
  WHERE organization_id = '77777777-7777-7777-7777-777777777777'
    AND (
      name ILIKE 'Lead Smoke %'
      OR name ILIKE 'Lead Browser %'
      OR email ILIKE 'lead.smoke.%@example.com'
      OR email ILIKE 'lead.browser.%@example.com'
      OR email ILIKE 'qa-lead-%@example.com'
    )
);

DELETE FROM public.deal_contracts
WHERE contact_id IN (
  SELECT id FROM public.contacts
  WHERE organization_id = '77777777-7777-7777-7777-777777777777'
    AND (
      name ILIKE 'Lead Smoke %'
      OR name ILIKE 'Lead Browser %'
      OR email ILIKE 'lead.smoke.%@example.com'
      OR email ILIKE 'lead.browser.%@example.com'
      OR email ILIKE 'qa-lead-%@example.com'
    )
);

DELETE FROM public.deal_proposals
WHERE contact_id IN (
  SELECT id FROM public.contacts
  WHERE organization_id = '77777777-7777-7777-7777-777777777777'
    AND (
      name ILIKE 'Lead Smoke %'
      OR name ILIKE 'Lead Browser %'
      OR email ILIKE 'lead.smoke.%@example.com'
      OR email ILIKE 'lead.browser.%@example.com'
      OR email ILIKE 'qa-lead-%@example.com'
    )
);

DELETE FROM public.contacts
WHERE organization_id = '77777777-7777-7777-7777-777777777777'
  AND (
    name ILIKE 'Lead Smoke %'
    OR name ILIKE 'Lead Browser %'
    OR email ILIKE 'lead.smoke.%@example.com'
    OR email ILIKE 'lead.browser.%@example.com'
    OR email ILIKE 'qa-lead-%@example.com'
  );

-- Contatos base da demo
INSERT INTO public.contacts (
  id,
  organization_id,
  name,
  email,
  phone,
  status,
  type,
  assigned_to,
  notes,
  created_at,
  updated_at,
  city,
  interest_profile,
  interest_type,
  interest_bedrooms,
  interest_price_max,
  ai_status,
  ai_score,
  ai_last_summary,
  qualified_by_ai_at,
  handoff_to_profile_id,
  handoff_at,
  interest_neighborhoods,
  deal_stage
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '77777777-7777-7777-7777-777777777777',
    'Carla Proprietária',
    'carla.owner@example.com',
    '+55 11 99888-1111',
    'new',
    'owner',
    '92b7f3e1-4038-48b4-90e4-2de895a0dc5d',
    'Proprietária principal do imóvel demo.',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '2 days',
    'São Paulo',
    '{}'::jsonb,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    ARRAY['Centro'],
    'lead'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '77777777-7777-7777-7777-777777777777',
    'Mariana Compradora',
    'mariana.compradora@example.com',
    '+55 11 97777-2222',
    'won',
    'contact',
    'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
    'Lead que percorreu o funil e fechou negócio.',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 hours',
    'São Paulo',
    '{"transaction":"sale","property_type":"apartment","price_max":480000,"city":"São Paulo"}'::jsonb,
    'apartment',
    2,
    480000,
    'qualified',
    91,
    'Lead pronto para fechamento, com visita realizada e proposta aceita.',
    NOW() - INTERVAL '2 days',
    'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
    NOW() - INTERVAL '2 days',
    ARRAY['Centro', 'Bela Vista'],
    'won'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '77777777-7777-7777-7777-777777777777',
    'Lucas Lead IA',
    'lucas.ia@example.com',
    '+55 11 96666-3333',
    'contacted',
    'contact',
    'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
    'Lead em pré-atendimento IA com handoff pendente.',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '30 minutes',
    'São Paulo',
    '{"transaction":"sale","property_type":"apartment","price_max":520000,"city":"São Paulo"}'::jsonb,
    'apartment',
    2,
    520000,
    'handoff_requested',
    82,
    'Lead já qualificado pela IA e pronto para abordagem do corretor.',
    NOW() - INTERVAL '18 hours',
    'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
    NOW() - INTERVAL '8 hours',
    ARRAY['Centro', 'Liberdade'],
    'closing'
  )
ON CONFLICT (id) DO UPDATE
SET
  organization_id = EXCLUDED.organization_id,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  status = EXCLUDED.status,
  type = EXCLUDED.type,
  assigned_to = EXCLUDED.assigned_to,
  notes = EXCLUDED.notes,
  updated_at = EXCLUDED.updated_at,
  city = EXCLUDED.city,
  interest_profile = EXCLUDED.interest_profile,
  interest_type = EXCLUDED.interest_type,
  interest_bedrooms = EXCLUDED.interest_bedrooms,
  interest_price_max = EXCLUDED.interest_price_max,
  ai_status = EXCLUDED.ai_status,
  ai_score = EXCLUDED.ai_score,
  ai_last_summary = EXCLUDED.ai_last_summary,
  qualified_by_ai_at = EXCLUDED.qualified_by_ai_at,
  handoff_to_profile_id = EXCLUDED.handoff_to_profile_id,
  handoff_at = EXCLUDED.handoff_at,
  interest_neighborhoods = EXCLUDED.interest_neighborhoods,
  deal_stage = EXCLUDED.deal_stage;

-- Imóvel demo publicado
INSERT INTO public.properties (
  id,
  organization_id,
  external_id,
  public_code,
  title,
  description,
  price,
  type,
  status,
  features,
  address,
  images,
  image_paths,
  hide_from_site,
  assigned_to,
  created_at,
  updated_at,
  transaction_type,
  purpose,
  owner_name,
  financing_allowed,
  total_area,
  built_area,
  publish_to_portals,
  publish_zap,
  publish_imovelweb,
  publish_olx,
  owner_contact_id
)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '77777777-7777-7777-7777-777777777777',
  'DEMO-APT-001',
  'DEMO-001',
  'Apartamento demo no Centro',
  'Apartamento pronto para demonstração do fluxo vendável, com vitrine pública, lead por site, proposta e contrato já registrados.',
  470000,
  'apartment',
  'available',
  '{"bedrooms":2,"bathrooms":2,"area":68}'::jsonb,
  '{"full_address":"Rua Demo, 100 | Centro - São Paulo - SP | CEP 01000-000","street":"Rua Demo","number":"100","neighborhood":"Centro","city":"São Paulo","state":"SP","zip":"01000-000","country":"Brasil"}'::jsonb,
  ARRAY[]::text[],
  ARRAY[]::text[],
  FALSE,
  'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '1 hour',
  'sale',
  'residential',
  'Carla Proprietária',
  TRUE,
  75,
  68,
  TRUE,
  TRUE,
  TRUE,
  FALSE,
  '11111111-1111-1111-1111-111111111111'
)
ON CONFLICT (id) DO UPDATE
SET
  organization_id = EXCLUDED.organization_id,
  external_id = EXCLUDED.external_id,
  public_code = EXCLUDED.public_code,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  features = EXCLUDED.features,
  address = EXCLUDED.address,
  images = EXCLUDED.images,
  image_paths = EXCLUDED.image_paths,
  hide_from_site = EXCLUDED.hide_from_site,
  assigned_to = EXCLUDED.assigned_to,
  updated_at = EXCLUDED.updated_at,
  transaction_type = EXCLUDED.transaction_type,
  purpose = EXCLUDED.purpose,
  owner_name = EXCLUDED.owner_name,
  financing_allowed = EXCLUDED.financing_allowed,
  total_area = EXCLUDED.total_area,
  built_area = EXCLUDED.built_area,
  publish_to_portals = EXCLUDED.publish_to_portals,
  publish_zap = EXCLUDED.publish_zap,
  publish_imovelweb = EXCLUDED.publish_imovelweb,
  publish_olx = EXCLUDED.publish_olx,
  owner_contact_id = EXCLUDED.owner_contact_id;

-- Agendamentos
INSERT INTO public.appointments (
  id,
  organization_id,
  property_id,
  contact_id,
  assigned_to,
  date,
  status,
  notes,
  created_at,
  updated_at
)
VALUES
  (
    '55555555-5555-5555-5555-555555555551',
    '77777777-7777-7777-7777-777777777777',
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
    NOW() - INTERVAL '2 days',
    'completed',
    'Visita concluída antes da proposta aceita.',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '55555555-5555-5555-5555-555555555552',
    '77777777-7777-7777-7777-777777777777',
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
    NOW() + INTERVAL '1 day',
    'scheduled',
    'Visita futura gerada para a demo de follow-up comercial.',
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '12 hours'
  )
ON CONFLICT (id) DO UPDATE
SET
  property_id = EXCLUDED.property_id,
  contact_id = EXCLUDED.contact_id,
  assigned_to = EXCLUDED.assigned_to,
  date = EXCLUDED.date,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = EXCLUDED.updated_at;

-- Proposta e contrato
INSERT INTO public.deal_proposals (
  id,
  organization_id,
  contact_id,
  assigned_to,
  property_id,
  proposed_value,
  payment_conditions,
  valid_until,
  status,
  notes,
  created_at,
  updated_at
)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '77777777-7777-7777-7777-777777777777',
  '22222222-2222-2222-2222-222222222222',
  'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
  '44444444-4444-4444-4444-444444444444',
  470000,
  'Entrada de 20% + financiamento bancário',
  '2026-05-31',
  'accepted',
  'Proposta aceita na base demo.',
  NOW() - INTERVAL '36 hours',
  NOW() - INTERVAL '30 hours'
)
ON CONFLICT (id) DO UPDATE
SET
  contact_id = EXCLUDED.contact_id,
  assigned_to = EXCLUDED.assigned_to,
  property_id = EXCLUDED.property_id,
  proposed_value = EXCLUDED.proposed_value,
  payment_conditions = EXCLUDED.payment_conditions,
  valid_until = EXCLUDED.valid_until,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.deal_contracts (
  id,
  organization_id,
  property_id,
  contact_id,
  assigned_to,
  proposal_id,
  contract_type,
  final_value,
  commission_value,
  status,
  start_date,
  end_date,
  document_url,
  created_at,
  updated_at
)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '77777777-7777-7777-7777-777777777777',
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
  '66666666-6666-6666-6666-666666666666',
  'sale',
  470000,
  23500,
  'completed',
  '2026-04-23',
  NULL,
  'https://example.com/contratos/demo-001.pdf',
  NOW() - INTERVAL '24 hours',
  NOW() - INTERVAL '12 hours'
)
ON CONFLICT (id) DO UPDATE
SET
  property_id = EXCLUDED.property_id,
  contact_id = EXCLUDED.contact_id,
  assigned_to = EXCLUDED.assigned_to,
  proposal_id = EXCLUDED.proposal_id,
  contract_type = EXCLUDED.contract_type,
  final_value = EXCLUDED.final_value,
  commission_value = EXCLUDED.commission_value,
  status = EXCLUDED.status,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  document_url = EXCLUDED.document_url,
  updated_at = EXCLUDED.updated_at;

-- Timeline, origem e interações
INSERT INTO public.contact_events (
  id,
  organization_id,
  contact_id,
  type,
  source,
  payload,
  created_at
)
VALUES
  (
    'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '77777777-7777-7777-7777-777777777777',
    '22222222-2222-2222-2222-222222222222',
    'lead_received',
    'site',
    '{"property_id":"44444444-4444-4444-4444-444444444444","site_slug":"demo-vivacrm","source_domain":"demo.local","utm_campaign":"abril-demo","message_preview":"Quero agendar visita"}'::jsonb,
    NOW() - INTERVAL '4 days'
  ),
  (
    'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '77777777-7777-7777-7777-777777777777',
    '22222222-2222-2222-2222-222222222222',
    'note_added',
    'lead_distribution',
    '{"action":"assigned","reason":"site","mode":"round_robin","assigned_to":"b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c"}'::jsonb,
    NOW() - INTERVAL '4 days' + INTERVAL '2 minutes'
  ),
  (
    'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '77777777-7777-7777-7777-777777777777',
    '33333333-3333-3333-3333-333333333333',
    'lead_received',
    'site',
    '{"property_id":"44444444-4444-4444-4444-444444444444","site_slug":"demo-vivacrm","source_domain":"demo.local","utm_campaign":"ia-pilot"}'::jsonb,
    NOW() - INTERVAL '1 day'
  ),
  (
    'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    '77777777-7777-7777-7777-777777777777',
    '33333333-3333-3333-3333-333333333333',
    'note_added',
    'ai_leads',
    '{"text":"Lead qualificado pela IA e aguardando corretor.","stage_score":82}'::jsonb,
    NOW() - INTERVAL '8 hours'
  )
ON CONFLICT (id) DO UPDATE
SET
  payload = EXCLUDED.payload,
  created_at = EXCLUDED.created_at;

INSERT INTO public.messages (
  id,
  organization_id,
  contact_id,
  direction,
  channel,
  body,
  created_at
)
VALUES
  (
    'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    '77777777-7777-7777-7777-777777777777',
    '22222222-2222-2222-2222-222222222222',
    'in',
    'site_form',
    'Tenho interesse no apartamento demo e gostaria de visitar.',
    NOW() - INTERVAL '4 days'
  ),
  (
    'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    '77777777-7777-7777-7777-777777777777',
    '22222222-2222-2222-2222-222222222222',
    'out',
    'whatsapp_official_sandbox',
    'Olá, Mariana! Confirmamos sua visita ao imóvel demo.',
    NOW() - INTERVAL '3 days'
  )
ON CONFLICT (id) DO UPDATE
SET
  body = EXCLUDED.body,
  created_at = EXCLUDED.created_at;

INSERT INTO public.contact_interactions (
  id,
  organization_id,
  contact_id,
  created_by,
  type,
  direction,
  summary,
  happened_at,
  created_at
)
VALUES
  (
    'ccccccc1-cccc-cccc-cccc-ccccccccccc1',
    '77777777-7777-7777-7777-777777777777',
    '22222222-2222-2222-2222-222222222222',
    'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
    'visit',
    'outbound',
    'Visita realizada no imóvel demo com boa aderência ao perfil.',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'ccccccc2-cccc-cccc-cccc-ccccccccccc2',
    '77777777-7777-7777-7777-777777777777',
    '33333333-3333-3333-3333-333333333333',
    'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
    'whatsapp',
    'outbound',
    'Corretor assumiu o lead IA e seguirá por WhatsApp sandbox.',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
  )
ON CONFLICT (id) DO UPDATE
SET
  summary = EXCLUDED.summary,
  happened_at = EXCLUDED.happened_at;

INSERT INTO public.followup_jobs (
  id,
  organization_id,
  contact_id,
  step,
  status,
  source,
  template_body,
  scheduled_at,
  processed_at,
  error,
  created_at,
  updated_at
)
VALUES (
  'ddddddd1-dddd-dddd-dddd-ddddddddddd1',
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333333',
  '24h',
  'pending',
  'lead_received',
  'Mensagem de follow-up pendente para lead IA demo.',
  NOW() + INTERVAL '4 hours',
  NULL,
  NULL,
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '1 hour'
)
ON CONFLICT (id) DO UPDATE
SET
  status = EXCLUDED.status,
  template_body = EXCLUDED.template_body,
  scheduled_at = EXCLUDED.scheduled_at,
  updated_at = EXCLUDED.updated_at;

-- Fila IA demonstrável
INSERT INTO public.ai_lead_sessions (
  id,
  organization_id,
  contact_id,
  status,
  source,
  current_step,
  assigned_to_at_handoff,
  started_at,
  last_message_at,
  qualified_at,
  handoff_requested_at,
  handoff_completed_at,
  paused_at,
  closed_at,
  created_at,
  updated_at
)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333333',
  'handoff_requested',
  'site',
  'handoff',
  'b5c4f51b-a4af-4db5-a5d9-f7d2f112f04c',
  NOW() - INTERVAL '18 hours',
  NOW() - INTERVAL '30 minutes',
  NOW() - INTERVAL '10 hours',
  NOW() - INTERVAL '8 hours',
  NULL,
  NULL,
  NULL,
  NOW() - INTERVAL '18 hours',
  NOW() - INTERVAL '30 minutes'
)
ON CONFLICT (id) DO UPDATE
SET
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  current_step = EXCLUDED.current_step,
  assigned_to_at_handoff = EXCLUDED.assigned_to_at_handoff,
  last_message_at = EXCLUDED.last_message_at,
  qualified_at = EXCLUDED.qualified_at,
  handoff_requested_at = EXCLUDED.handoff_requested_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.ai_lead_qualifications (
  session_id,
  organization_id,
  intent,
  transaction_type,
  property_type,
  city,
  neighborhoods,
  budget_min,
  budget_max,
  timeline,
  stage_score,
  summary,
  updated_at
)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  '77777777-7777-7777-7777-777777777777',
  'buy',
  'sale',
  'apartment',
  'São Paulo',
  ARRAY['Centro', 'Liberdade'],
  420000,
  520000,
  'até 30 dias',
  82,
  'Busca apartamento de 2 quartos no Centro, com alta intenção e urgência de decisão.',
  NOW() - INTERVAL '30 minutes'
)
ON CONFLICT (session_id) DO UPDATE
SET
  intent = EXCLUDED.intent,
  transaction_type = EXCLUDED.transaction_type,
  property_type = EXCLUDED.property_type,
  city = EXCLUDED.city,
  neighborhoods = EXCLUDED.neighborhoods,
  budget_min = EXCLUDED.budget_min,
  budget_max = EXCLUDED.budget_max,
  timeline = EXCLUDED.timeline,
  stage_score = EXCLUDED.stage_score,
  summary = EXCLUDED.summary,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.ai_lead_messages (
  id,
  organization_id,
  session_id,
  direction,
  author,
  channel,
  content,
  payload_json,
  created_at
)
VALUES
  (
    'eeeeeee1-eeee-eeee-eeee-eeeeeeeeeee1',
    '77777777-7777-7777-7777-777777777777',
    '99999999-9999-9999-9999-999999999999',
    'inbound',
    'contact',
    'whatsapp',
    'Procuro um apartamento no Centro com 2 quartos.',
    '{}'::jsonb,
    NOW() - INTERVAL '17 hours'
  ),
  (
    'eeeeeee2-eeee-eeee-eeee-eeeeeeeeeee2',
    '77777777-7777-7777-7777-777777777777',
    '99999999-9999-9999-9999-999999999999',
    'outbound',
    'ai',
    'whatsapp_official_sandbox',
    'Perfeito, Lucas. Qual sua faixa de orçamento para este imóvel?',
    '{"operation_mode":"sandbox"}'::jsonb,
    NOW() - INTERVAL '16 hours 50 minutes'
  ),
  (
    'eeeeeee3-eeee-eeee-eeee-eeeeeeeeeee3',
    '77777777-7777-7777-7777-777777777777',
    '99999999-9999-9999-9999-999999999999',
    'inbound',
    'contact',
    'whatsapp',
    'Quero algo até 520 mil e consigo decidir este mês.',
    '{}'::jsonb,
    NOW() - INTERVAL '16 hours 30 minutes'
  )
ON CONFLICT (id) DO UPDATE
SET
  content = EXCLUDED.content,
  payload_json = EXCLUDED.payload_json,
  created_at = EXCLUDED.created_at;

-- Integrações de portal
INSERT INTO public.portal_integrations (
  id,
  organization_id,
  portal,
  status,
  config,
  last_sync_at,
  last_error,
  created_at,
  updated_at
)
VALUES
  (
    'f1111111-1111-1111-1111-111111111111',
    '77777777-7777-7777-7777-777777777777',
    'zap_vivareal',
    'active',
    '{"feed_enabled":true,"token_mask":"zap-demo"}'::jsonb,
    NOW() - INTERVAL '1 hour',
    NULL,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '1 hour'
  ),
  (
    'f2222222-2222-2222-2222-222222222222',
    '77777777-7777-7777-7777-777777777777',
    'imovelweb',
    'attention',
    '{"feed_enabled":true,"token_mask":"iw-demo"}'::jsonb,
    NOW() - INTERVAL '3 hours',
    'Última carga concluída com aviso de mapeamento opcional.',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '3 hours'
  ),
  (
    'f3333333-3333-3333-3333-333333333333',
    '77777777-7777-7777-7777-777777777777',
    'olx',
    'inactive',
    '{"feed_enabled":false}'::jsonb,
    NULL,
    NULL,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  )
ON CONFLICT (id) DO UPDATE
SET
  status = EXCLUDED.status,
  config = EXCLUDED.config,
  last_sync_at = EXCLUDED.last_sync_at,
  last_error = EXCLUDED.last_error,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.portal_integration_runs (
  id,
  organization_id,
  portal,
  kind,
  status,
  properties_count,
  bytes,
  content_type,
  message,
  created_at
)
VALUES
  (
    'f4444444-4444-4444-4444-444444444444',
    '77777777-7777-7777-7777-777777777777',
    'zap_vivareal',
    'test_feed',
    'ok',
    1,
    1240,
    'application/xml',
    'Feed validado com 1 imóvel.',
    NOW() - INTERVAL '1 hour'
  ),
  (
    'f5555555-5555-5555-5555-555555555555',
    '77777777-7777-7777-7777-777777777777',
    'imovelweb',
    'test_feed',
    'ok',
    1,
    1180,
    'application/xml',
    'Feed publicado com aviso leve.',
    NOW() - INTERVAL '3 hours'
  )
ON CONFLICT (id) DO UPDATE
SET
  status = EXCLUDED.status,
  properties_count = EXCLUDED.properties_count,
  bytes = EXCLUDED.bytes,
  content_type = EXCLUDED.content_type,
  message = EXCLUDED.message,
  created_at = EXCLUDED.created_at;

INSERT INTO public.portal_integration_issues (
  id,
  organization_id,
  portal,
  property_id,
  severity,
  issue_key,
  message_human,
  message_technical,
  is_resolved,
  created_at,
  resolved_at
)
VALUES (
  'f6666666-6666-6666-6666-666666666666',
  '77777777-7777-7777-7777-777777777777',
  'imovelweb',
  '44444444-4444-4444-4444-444444444444',
  'warning',
  'optional_field_missing',
  'Campo opcional de destaque não foi enviado ao Imovelweb.',
  'listing.highlight missing in demo feed',
  FALSE,
  NOW() - INTERVAL '3 hours',
  NULL
)
ON CONFLICT (id) DO UPDATE
SET
  message_human = EXCLUDED.message_human,
  message_technical = EXCLUDED.message_technical,
  is_resolved = EXCLUDED.is_resolved,
  created_at = EXCLUDED.created_at,
  resolved_at = EXCLUDED.resolved_at;

-- WhatsApp sandbox demonstrável sem credencial Meta real
INSERT INTO public.whatsapp_addon_pricing_settings (
  organization_id,
  addon_enabled,
  included_quota,
  overage_price,
  currency_code,
  billing_timezone,
  created_at,
  updated_at
)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  TRUE,
  100,
  0,
  'BRL',
  'America/Sao_Paulo',
  NOW() - INTERVAL '5 days',
  NOW()
)
ON CONFLICT (organization_id) DO UPDATE
SET
  addon_enabled = EXCLUDED.addon_enabled,
  included_quota = EXCLUDED.included_quota,
  overage_price = EXCLUDED.overage_price,
  currency_code = EXCLUDED.currency_code,
  billing_timezone = EXCLUDED.billing_timezone,
  updated_at = NOW();

INSERT INTO public.whatsapp_channel_settings (
  organization_id,
  provider,
  display_phone,
  business_account_id,
  phone_number_id,
  webhook_verify_token,
  access_token,
  access_token_last4,
  status,
  last_error_message,
  last_tested_at,
  created_at,
  updated_at,
  operation_mode
)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  'meta',
  '+55 11 99999-0000',
  NULL,
  NULL,
  'sandbox-demo-token',
  NULL,
  NULL,
  'connected',
  NULL,
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '5 days',
  NOW(),
  'sandbox'
)
ON CONFLICT (organization_id) DO UPDATE
SET
  provider = EXCLUDED.provider,
  display_phone = EXCLUDED.display_phone,
  business_account_id = EXCLUDED.business_account_id,
  phone_number_id = EXCLUDED.phone_number_id,
  webhook_verify_token = EXCLUDED.webhook_verify_token,
  access_token = EXCLUDED.access_token,
  access_token_last4 = EXCLUDED.access_token_last4,
  status = EXCLUDED.status,
  last_error_message = EXCLUDED.last_error_message,
  last_tested_at = EXCLUDED.last_tested_at,
  updated_at = NOW(),
  operation_mode = EXCLUDED.operation_mode;

INSERT INTO public.webhook_endpoints (
  id,
  organization_id,
  token,
  source,
  is_active,
  created_at
)
VALUES (
  'f7777777-7777-7777-7777-777777777777',
  '77777777-7777-7777-7777-777777777777',
  'sandbox-demo-token',
  'whatsapp_inbound',
  TRUE,
  NOW() - INTERVAL '5 days'
)
ON CONFLICT (id) DO UPDATE
SET
  token = EXCLUDED.token,
  source = EXCLUDED.source,
  is_active = EXCLUDED.is_active;
