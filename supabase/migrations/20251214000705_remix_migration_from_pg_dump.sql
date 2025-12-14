CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'supervisor',
    'operator',
    'logistics'
);


--
-- Name: automation_action_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.automation_action_type AS ENUM (
    'create_work_order',
    'update_work_order_status',
    'update_item_status',
    'log_activity',
    'trigger_outgoing_webhook'
);


--
-- Name: operator_initials; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.operator_initials AS ENUM (
    'MB',
    'HL',
    'AB',
    'EV'
);


--
-- Name: product_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_type AS ENUM (
    'SDM_ECO',
    'SENSOR',
    'MLA',
    'HMI',
    'TRANSMITTER'
);


--
-- Name: step_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.step_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'skipped'
);


--
-- Name: work_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.work_order_status AS ENUM (
    'planned',
    'in_progress',
    'on_hold',
    'completed',
    'cancelled'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, language)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'operator'),
    COALESCE(NEW.raw_user_meta_data->>'language', 'en')
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: prevent_role_self_modification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_role_self_modification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- If role is being changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Check if the current user is an admin in user_roles table
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    ) THEN
      -- Non-admin trying to change role - reject
      RAISE EXCEPTION 'Only administrators can modify user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    incoming_webhook_id uuid NOT NULL,
    name text NOT NULL,
    action_type public.automation_action_type NOT NULL,
    field_mappings jsonb DEFAULT '{}'::jsonb NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb,
    enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: batch_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_item_id uuid NOT NULL,
    material_type text NOT NULL,
    batch_number text NOT NULL,
    scanned_at timestamp with time zone DEFAULT now(),
    scanned_by uuid,
    production_step_id uuid,
    opening_date date,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: certificate_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificate_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    product_type text,
    template_url text NOT NULL,
    field_mappings jsonb DEFAULT '{}'::jsonb NOT NULL,
    detected_fields text[] DEFAULT '{}'::text[],
    is_default boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    production_step_id uuid NOT NULL,
    item_text_en text NOT NULL,
    item_text_nl text NOT NULL,
    required boolean DEFAULT true NOT NULL,
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: checklist_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    step_execution_id uuid NOT NULL,
    checklist_item_id uuid NOT NULL,
    checked boolean DEFAULT false NOT NULL,
    checked_by uuid,
    checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: incoming_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incoming_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    endpoint_key text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text) NOT NULL,
    secret_key text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_triggered_at timestamp with time zone,
    trigger_count integer DEFAULT 0 NOT NULL
);


--
-- Name: inventory_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    batch_number text,
    quantity_on_hand integer DEFAULT 0 NOT NULL,
    quantity_reserved integer DEFAULT 0 NOT NULL,
    received_date date,
    expiry_date date,
    opening_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_type text NOT NULL,
    material_id uuid NOT NULL,
    inventory_stock_id uuid,
    batch_number text,
    quantity integer NOT NULL,
    quantity_before integer,
    quantity_after integer,
    reference_type text,
    reference_id uuid,
    work_order_id uuid,
    work_order_item_id uuid,
    production_step_id uuid,
    notes text,
    performed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['receive'::text, 'consume'::text, 'adjust'::text, 'reserve'::text, 'unreserve'::text])))
);


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    name_nl text,
    description text,
    category text DEFAULT 'component'::text NOT NULL,
    material_type text NOT NULL,
    unit_of_measure text DEFAULT 'pcs'::text NOT NULL,
    track_batches boolean DEFAULT true NOT NULL,
    track_expiry boolean DEFAULT false NOT NULL,
    shelf_life_days integer,
    supplier_name text,
    supplier_sku text,
    lead_time_days integer,
    reorder_point integer DEFAULT 0 NOT NULL,
    reorder_quantity integer,
    min_order_quantity integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    entity_type text,
    entity_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: production_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_type public.product_type NOT NULL,
    step_number integer NOT NULL,
    title_en text NOT NULL,
    title_nl text NOT NULL,
    description_en text,
    description_nl text,
    requires_barcode_scan boolean DEFAULT false NOT NULL,
    requires_value_input boolean DEFAULT false NOT NULL,
    value_label_en text,
    value_label_nl text,
    value_unit text,
    requires_batch_number boolean DEFAULT false NOT NULL,
    batch_type text,
    has_checklist boolean DEFAULT false NOT NULL,
    conditional_on_step integer,
    conditional_value text,
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    validation_rules jsonb,
    measurement_fields jsonb,
    restart_from_step integer,
    blocks_on_failure boolean DEFAULT false
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    role public.app_role DEFAULT 'operator'::public.app_role NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text,
    notification_prefs jsonb DEFAULT '{"push": false, "email": false, "in_app": true, "mentions": true, "step_completions": false, "work_order_updates": true}'::jsonb
);


--
-- Name: quality_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_item_id uuid NOT NULL,
    certificate_data jsonb NOT NULL,
    generated_at timestamp with time zone DEFAULT now(),
    generated_by uuid,
    pdf_url text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: step_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.step_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_item_id uuid NOT NULL,
    production_step_id uuid NOT NULL,
    status public.step_status DEFAULT 'pending'::public.step_status NOT NULL,
    executed_by uuid,
    barcode_scanned text,
    value_recorded text,
    batch_number text,
    notes text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    operator_initials public.operator_initials,
    validation_status text DEFAULT 'pending'::text,
    validation_message text,
    measurement_values jsonb DEFAULT '{}'::jsonb,
    retry_count integer DEFAULT 0
);


--
-- Name: sub_assemblies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub_assemblies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_item_id uuid NOT NULL,
    child_item_id uuid NOT NULL,
    component_type public.product_type NOT NULL,
    linked_at timestamp with time zone DEFAULT now() NOT NULL,
    linked_by uuid
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    setting_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    incoming_webhook_id uuid NOT NULL,
    request_body jsonb,
    request_headers jsonb,
    response_status integer,
    response_body jsonb,
    error_message text,
    executed_rules jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: work_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_id uuid NOT NULL,
    serial_number text NOT NULL,
    position_in_batch integer NOT NULL,
    current_step integer DEFAULT 1 NOT NULL,
    status public.work_order_status DEFAULT 'planned'::public.work_order_status NOT NULL,
    assigned_to uuid,
    label_printed boolean DEFAULT false NOT NULL,
    quality_approved boolean DEFAULT false NOT NULL,
    certificate_generated boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    operator_initials public.operator_initials,
    label_printed_at timestamp with time zone,
    label_printed_by uuid,
    product_type text
);


--
-- Name: work_order_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_id uuid NOT NULL,
    work_order_item_id uuid,
    step_number integer,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reply_to_id uuid,
    mentions uuid[] DEFAULT '{}'::uuid[]
);


--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wo_number text NOT NULL,
    product_type public.product_type NOT NULL,
    batch_size integer NOT NULL,
    status public.work_order_status DEFAULT 'planned'::public.work_order_status NOT NULL,
    parent_wo_id uuid,
    created_by uuid NOT NULL,
    assigned_to uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    scheduled_date date,
    customer_name text,
    external_order_number text,
    order_value numeric(10,2),
    start_date date,
    shipping_date date,
    cancellation_reason text,
    CONSTRAINT work_orders_batch_size_check CHECK ((batch_size > 0))
);


--
-- Name: zapier_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zapier_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    webhook_url text NOT NULL,
    event_type text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);


--
-- Name: batch_materials batch_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_materials
    ADD CONSTRAINT batch_materials_pkey PRIMARY KEY (id);


--
-- Name: certificate_templates certificate_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_templates
    ADD CONSTRAINT certificate_templates_pkey PRIMARY KEY (id);


--
-- Name: checklist_items checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_pkey PRIMARY KEY (id);


--
-- Name: checklist_responses checklist_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_responses
    ADD CONSTRAINT checklist_responses_pkey PRIMARY KEY (id);


--
-- Name: checklist_responses checklist_responses_step_execution_id_checklist_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_responses
    ADD CONSTRAINT checklist_responses_step_execution_id_checklist_item_id_key UNIQUE (step_execution_id, checklist_item_id);


--
-- Name: incoming_webhooks incoming_webhooks_endpoint_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incoming_webhooks
    ADD CONSTRAINT incoming_webhooks_endpoint_key_key UNIQUE (endpoint_key);


--
-- Name: incoming_webhooks incoming_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incoming_webhooks
    ADD CONSTRAINT incoming_webhooks_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock inventory_stock_material_id_batch_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT inventory_stock_material_id_batch_number_key UNIQUE (material_id, batch_number);


--
-- Name: inventory_stock inventory_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT inventory_stock_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: materials materials_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_sku_key UNIQUE (sku);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: production_steps production_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_steps
    ADD CONSTRAINT production_steps_pkey PRIMARY KEY (id);


--
-- Name: production_steps production_steps_product_type_step_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_steps
    ADD CONSTRAINT production_steps_product_type_step_number_key UNIQUE (product_type, step_number);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: quality_certificates quality_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_certificates
    ADD CONSTRAINT quality_certificates_pkey PRIMARY KEY (id);


--
-- Name: step_executions step_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_executions
    ADD CONSTRAINT step_executions_pkey PRIMARY KEY (id);


--
-- Name: sub_assemblies sub_assemblies_parent_item_id_child_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_assemblies
    ADD CONSTRAINT sub_assemblies_parent_item_id_child_item_id_key UNIQUE (parent_item_id, child_item_id);


--
-- Name: sub_assemblies sub_assemblies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_assemblies
    ADD CONSTRAINT sub_assemblies_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);


--
-- Name: webhook_logs webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: work_order_items work_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT work_order_items_pkey PRIMARY KEY (id);


--
-- Name: work_order_items work_order_items_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT work_order_items_serial_number_key UNIQUE (serial_number);


--
-- Name: work_order_items work_order_items_work_order_id_position_in_batch_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT work_order_items_work_order_id_position_in_batch_key UNIQUE (work_order_id, position_in_batch);


--
-- Name: work_order_notes work_order_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_notes
    ADD CONSTRAINT work_order_notes_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_wo_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_wo_number_key UNIQUE (wo_number);


--
-- Name: zapier_webhooks zapier_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zapier_webhooks
    ADD CONSTRAINT zapier_webhooks_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: idx_batch_materials_material_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_materials_material_type ON public.batch_materials USING btree (material_type);


--
-- Name: idx_batch_materials_work_order_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_materials_work_order_item ON public.batch_materials USING btree (work_order_item_id);


--
-- Name: idx_inventory_stock_batch_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_stock_batch_number ON public.inventory_stock USING btree (batch_number);


--
-- Name: idx_inventory_stock_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_stock_material_id ON public.inventory_stock USING btree (material_id);


--
-- Name: idx_inventory_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_created_at ON public.inventory_transactions USING btree (created_at);


--
-- Name: idx_inventory_transactions_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_material_id ON public.inventory_transactions USING btree (material_id);


--
-- Name: idx_materials_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_active ON public.materials USING btree (active);


--
-- Name: idx_materials_material_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_material_type ON public.materials USING btree (material_type);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, read) WHERE (read = false);


--
-- Name: idx_quality_certificates_work_order_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_certificates_work_order_item ON public.quality_certificates USING btree (work_order_item_id);


--
-- Name: idx_step_executions_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_executions_item_id ON public.step_executions USING btree (work_order_item_id);


--
-- Name: idx_step_executions_item_step; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_executions_item_step ON public.step_executions USING btree (work_order_item_id, production_step_id);


--
-- Name: idx_step_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_executions_status ON public.step_executions USING btree (status);


--
-- Name: idx_step_executions_validation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_step_executions_validation ON public.step_executions USING btree (validation_status);


--
-- Name: idx_work_order_items_product_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_order_items_product_type ON public.work_order_items USING btree (product_type);


--
-- Name: idx_work_order_items_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_order_items_serial ON public.work_order_items USING btree (serial_number);


--
-- Name: idx_work_order_items_wo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_order_items_wo_id ON public.work_order_items USING btree (work_order_id);


--
-- Name: idx_work_order_notes_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_order_notes_item ON public.work_order_notes USING btree (work_order_item_id);


--
-- Name: idx_work_order_notes_mentions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_order_notes_mentions ON public.work_order_notes USING gin (mentions);


--
-- Name: idx_work_order_notes_reply_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_order_notes_reply_to ON public.work_order_notes USING btree (reply_to_id);


--
-- Name: idx_work_order_notes_work_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_order_notes_work_order ON public.work_order_notes USING btree (work_order_id);


--
-- Name: idx_work_orders_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_orders_assigned_to ON public.work_orders USING btree (assigned_to);


--
-- Name: idx_work_orders_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_orders_created_by ON public.work_orders USING btree (created_by);


--
-- Name: idx_work_orders_scheduled_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_orders_scheduled_date ON public.work_orders USING btree (scheduled_date);


--
-- Name: idx_work_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_orders_status ON public.work_orders USING btree (status);


--
-- Name: profiles prevent_role_modification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_role_modification BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_modification();


--
-- Name: automation_rules update_automation_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: certificate_templates update_certificate_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_certificate_templates_updated_at BEFORE UPDATE ON public.certificate_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: incoming_webhooks update_incoming_webhooks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_incoming_webhooks_updated_at BEFORE UPDATE ON public.incoming_webhooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory_stock update_inventory_stock_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_inventory_stock_updated_at BEFORE UPDATE ON public.inventory_stock FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: materials update_materials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_settings update_system_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: work_order_items update_work_order_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_work_order_items_updated_at BEFORE UPDATE ON public.work_order_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: work_orders update_work_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: zapier_webhooks update_zapier_webhooks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_zapier_webhooks_updated_at BEFORE UPDATE ON public.zapier_webhooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: automation_rules automation_rules_incoming_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_incoming_webhook_id_fkey FOREIGN KEY (incoming_webhook_id) REFERENCES public.incoming_webhooks(id) ON DELETE CASCADE;


--
-- Name: batch_materials batch_materials_production_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_materials
    ADD CONSTRAINT batch_materials_production_step_id_fkey FOREIGN KEY (production_step_id) REFERENCES public.production_steps(id);


--
-- Name: batch_materials batch_materials_work_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_materials
    ADD CONSTRAINT batch_materials_work_order_item_id_fkey FOREIGN KEY (work_order_item_id) REFERENCES public.work_order_items(id) ON DELETE CASCADE;


--
-- Name: checklist_items checklist_items_production_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_production_step_id_fkey FOREIGN KEY (production_step_id) REFERENCES public.production_steps(id) ON DELETE CASCADE;


--
-- Name: checklist_responses checklist_responses_checked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_responses
    ADD CONSTRAINT checklist_responses_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES auth.users(id);


--
-- Name: checklist_responses checklist_responses_checklist_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_responses
    ADD CONSTRAINT checklist_responses_checklist_item_id_fkey FOREIGN KEY (checklist_item_id) REFERENCES public.checklist_items(id);


--
-- Name: checklist_responses checklist_responses_step_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_responses
    ADD CONSTRAINT checklist_responses_step_execution_id_fkey FOREIGN KEY (step_execution_id) REFERENCES public.step_executions(id) ON DELETE CASCADE;


--
-- Name: inventory_stock inventory_stock_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT inventory_stock_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: inventory_transactions inventory_transactions_inventory_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_inventory_stock_id_fkey FOREIGN KEY (inventory_stock_id) REFERENCES public.inventory_stock(id) ON DELETE SET NULL;


--
-- Name: inventory_transactions inventory_transactions_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: inventory_transactions inventory_transactions_production_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_production_step_id_fkey FOREIGN KEY (production_step_id) REFERENCES public.production_steps(id) ON DELETE SET NULL;


--
-- Name: inventory_transactions inventory_transactions_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;


--
-- Name: inventory_transactions inventory_transactions_work_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_work_order_item_id_fkey FOREIGN KEY (work_order_item_id) REFERENCES public.work_order_items(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: quality_certificates quality_certificates_work_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_certificates
    ADD CONSTRAINT quality_certificates_work_order_item_id_fkey FOREIGN KEY (work_order_item_id) REFERENCES public.work_order_items(id) ON DELETE CASCADE;


--
-- Name: step_executions step_executions_executed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_executions
    ADD CONSTRAINT step_executions_executed_by_fkey FOREIGN KEY (executed_by) REFERENCES auth.users(id);


--
-- Name: step_executions step_executions_production_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_executions
    ADD CONSTRAINT step_executions_production_step_id_fkey FOREIGN KEY (production_step_id) REFERENCES public.production_steps(id);


--
-- Name: step_executions step_executions_work_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_executions
    ADD CONSTRAINT step_executions_work_order_item_id_fkey FOREIGN KEY (work_order_item_id) REFERENCES public.work_order_items(id) ON DELETE CASCADE;


--
-- Name: sub_assemblies sub_assemblies_child_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_assemblies
    ADD CONSTRAINT sub_assemblies_child_item_id_fkey FOREIGN KEY (child_item_id) REFERENCES public.work_order_items(id) ON DELETE CASCADE;


--
-- Name: sub_assemblies sub_assemblies_linked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_assemblies
    ADD CONSTRAINT sub_assemblies_linked_by_fkey FOREIGN KEY (linked_by) REFERENCES auth.users(id);


--
-- Name: sub_assemblies sub_assemblies_parent_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_assemblies
    ADD CONSTRAINT sub_assemblies_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES public.work_order_items(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webhook_logs webhook_logs_incoming_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_incoming_webhook_id_fkey FOREIGN KEY (incoming_webhook_id) REFERENCES public.incoming_webhooks(id) ON DELETE CASCADE;


--
-- Name: work_order_items work_order_items_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT work_order_items_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id);


--
-- Name: work_order_items work_order_items_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_items
    ADD CONSTRAINT work_order_items_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_order_notes work_order_notes_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_notes
    ADD CONSTRAINT work_order_notes_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.work_order_notes(id) ON DELETE SET NULL;


--
-- Name: work_order_notes work_order_notes_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_notes
    ADD CONSTRAINT work_order_notes_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_order_notes work_order_notes_work_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_notes
    ADD CONSTRAINT work_order_notes_work_order_item_id_fkey FOREIGN KEY (work_order_item_id) REFERENCES public.work_order_items(id) ON DELETE CASCADE;


--
-- Name: work_orders work_orders_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id);


--
-- Name: work_orders work_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: work_orders work_orders_parent_wo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_parent_wo_id_fkey FOREIGN KEY (parent_wo_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;


--
-- Name: zapier_webhooks zapier_webhooks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zapier_webhooks
    ADD CONSTRAINT zapier_webhooks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: materials Admins and logistics can manage materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and logistics can manage materials" ON public.materials USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'supervisor'::public.app_role, 'logistics'::public.app_role]))))));


--
-- Name: inventory_stock Admins and logistics can manage stock; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and logistics can manage stock" ON public.inventory_stock USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'supervisor'::public.app_role, 'logistics'::public.app_role]))))));


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: automation_rules Admins can manage automation rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage automation rules" ON public.automation_rules USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: certificate_templates Admins can manage certificate templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage certificate templates" ON public.certificate_templates USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: checklist_items Admins can manage checklist items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage checklist items" ON public.checklist_items TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: incoming_webhooks Admins can manage incoming webhooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage incoming webhooks" ON public.incoming_webhooks USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: production_steps Admins can manage production steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage production steps" ON public.production_steps TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: system_settings Admins can manage settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage settings" ON public.system_settings USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: zapier_webhooks Admins can manage webhooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage webhooks" ON public.zapier_webhooks TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: webhook_logs Admins can view webhook logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view webhook logs" ON public.webhook_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: zapier_webhooks Admins can view webhooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view webhooks" ON public.zapier_webhooks FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: work_orders Assigned users can update work orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Assigned users can update work orders" ON public.work_orders FOR UPDATE TO authenticated USING (((auth.uid() = assigned_to) OR (auth.uid() = created_by) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'supervisor'::public.app_role])))))));


--
-- Name: inventory_transactions Authenticated users can insert transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert transactions" ON public.inventory_transactions FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: webhook_logs Service can insert webhook logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can insert webhook logs" ON public.webhook_logs FOR INSERT WITH CHECK (true);


--
-- Name: activity_logs System can insert activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert activity logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: notifications System can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: quality_certificates Users can create certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create certificates" ON public.quality_certificates FOR INSERT WITH CHECK (true);


--
-- Name: work_order_notes Users can create notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create notes" ON public.work_order_notes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: step_executions Users can create step executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create step executions" ON public.step_executions FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: work_orders Users can create work orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create work orders" ON public.work_orders FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: work_order_notes Users can delete own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own notes" ON public.work_order_notes FOR DELETE USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role))))));


--
-- Name: notifications Users can delete own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: batch_materials Users can insert batch materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert batch materials" ON public.batch_materials FOR INSERT WITH CHECK (((auth.uid() = scanned_by) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'supervisor'::public.app_role])))))));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: work_order_items Users can insert work order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert work order items" ON public.work_order_items FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.work_orders
  WHERE ((work_orders.id = work_order_items.work_order_id) AND ((work_orders.created_by = auth.uid()) OR (work_orders.assigned_to = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'supervisor'::public.app_role])))))));


--
-- Name: checklist_responses Users can manage checklist responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage checklist responses" ON public.checklist_responses TO authenticated USING (true);


--
-- Name: sub_assemblies Users can manage sub-assemblies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage sub-assemblies" ON public.sub_assemblies TO authenticated USING (true);


--
-- Name: work_order_items Users can update assigned items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update assigned items" ON public.work_order_items FOR UPDATE TO authenticated USING (((auth.uid() = assigned_to) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'supervisor'::public.app_role])))))));


--
-- Name: batch_materials Users can update batch materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update batch materials" ON public.batch_materials FOR UPDATE USING (((auth.uid() = scanned_by) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'supervisor'::public.app_role])))))));


--
-- Name: work_order_notes Users can update own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notes" ON public.work_order_notes FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: step_executions Users can update step executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update step executions" ON public.step_executions FOR UPDATE TO authenticated USING (true);


--
-- Name: certificate_templates Users can view active templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view active templates" ON public.certificate_templates FOR SELECT USING ((active = true));


--
-- Name: batch_materials Users can view all batch materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all batch materials" ON public.batch_materials FOR SELECT USING (true);


--
-- Name: quality_certificates Users can view all certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all certificates" ON public.quality_certificates FOR SELECT USING (true);


--
-- Name: checklist_items Users can view all checklist items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all checklist items" ON public.checklist_items FOR SELECT TO authenticated USING (true);


--
-- Name: checklist_responses Users can view all checklist responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all checklist responses" ON public.checklist_responses FOR SELECT TO authenticated USING (true);


--
-- Name: materials Users can view all materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all materials" ON public.materials FOR SELECT USING (true);


--
-- Name: work_order_notes Users can view all notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all notes" ON public.work_order_notes FOR SELECT USING (true);


--
-- Name: production_steps Users can view all production steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all production steps" ON public.production_steps FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Users can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: user_roles Users can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (true);


--
-- Name: step_executions Users can view all step executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all step executions" ON public.step_executions FOR SELECT TO authenticated USING (true);


--
-- Name: inventory_stock Users can view all stock; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all stock" ON public.inventory_stock FOR SELECT USING (true);


--
-- Name: sub_assemblies Users can view all sub-assemblies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all sub-assemblies" ON public.sub_assemblies FOR SELECT TO authenticated USING (true);


--
-- Name: inventory_transactions Users can view all transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all transactions" ON public.inventory_transactions FOR SELECT USING (true);


--
-- Name: work_order_items Users can view all work order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all work order items" ON public.work_order_items FOR SELECT TO authenticated USING (true);


--
-- Name: work_orders Users can view all work orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all work orders" ON public.work_orders FOR SELECT TO authenticated USING (true);


--
-- Name: activity_logs Users can view own activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own activity logs" ON public.activity_logs FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'supervisor'::public.app_role])))))));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: system_settings Users can view settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view settings" ON public.system_settings FOR SELECT USING (true);


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: batch_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.batch_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: certificate_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: incoming_webhooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.incoming_webhooks ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_stock; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: production_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: quality_certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_certificates ENABLE ROW LEVEL SECURITY;

--
-- Name: step_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.step_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: sub_assemblies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sub_assemblies ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: work_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: work_order_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_order_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: work_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: zapier_webhooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zapier_webhooks ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


