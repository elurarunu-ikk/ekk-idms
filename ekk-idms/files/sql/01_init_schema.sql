-- EKK IDMS — Initial Schema
-- Run order: 01 → 02 → 03 → seeds

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_code    VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(500) NOT NULL,
    client          VARCHAR(300),
    project_type    VARCHAR(50),
    location        VARCHAR(300),
    start_date      DATE,
    end_date        DATE,
    contract_value  NUMERIC(18,2),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(200) NOT NULL,
    email           VARCHAR(200) UNIQUE NOT NULL,
    role            VARCHAR(50),
    password_hash   VARCHAR(500) NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Disciplines master
CREATE TABLE IF NOT EXISTS disciplines (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(30) UNIQUE NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    sort_order  INTEGER DEFAULT 0
);

-- Discipline phases
CREATE TABLE IF NOT EXISTS discipline_phases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discipline_id   UUID REFERENCES disciplines(id),
    code            VARCHAR(30) UNIQUE NOT NULL,
    name            VARCHAR(200) NOT NULL,
    sort_order      INTEGER DEFAULT 0
);

-- Activity master (369 activities)
CREATE TABLE IF NOT EXISTS activity_master (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discipline_id   UUID REFERENCES disciplines(id),
    phase_id        UUID REFERENCES discipline_phases(id),
    code            VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(300) NOT NULL,
    unit            VARCHAR(20),
    sort_order      INTEGER DEFAULT 0
);

-- Project disciplines (which disciplines active per project)
CREATE TABLE IF NOT EXISTS project_disciplines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    discipline_id   UUID REFERENCES disciplines(id),
    activated_at    TIMESTAMP DEFAULT NOW(),
    activated_by    VARCHAR(200),
    UNIQUE(project_id, discipline_id)
);

-- BOQ items
CREATE TABLE IF NOT EXISTS boq_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    schedule_h_code VARCHAR(50),
    description     VARCHAR(500),
    unit            VARCHAR(20),
    quantity        NUMERIC(14,3),
    rate            NUMERIC(12,2),
    amount          NUMERIC(18,2)
);

-- Schedule H items
CREATE TABLE IF NOT EXISTS schedule_h_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(300),
    unit            VARCHAR(20),
    boq_unit        VARCHAR(20),
    min_threshold   NUMERIC(12,3),
    payment_terms   TEXT
);

-- Conversion factors per project per activity
CREATE TABLE IF NOT EXISTS conversion_factors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    schedule_h_code VARCHAR(50),
    activity_name   VARCHAR(300),
    boq_unit        VARCHAR(20),
    width_m         NUMERIC(8,3),
    thickness_m     NUMERIC(8,4),
    density         NUMERIC(8,3),
    cross_section   NUMERIC(10,4)
);

-- Site data transactions (master audit table)
CREATE TABLE IF NOT EXISTS site_data_transactions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id       UUID REFERENCES projects(id),
    source           VARCHAR(30),
    report_date      TIMESTAMP DEFAULT NOW(),
    activity_code    VARCHAR(50),
    chainage_from    NUMERIC(10,3),
    chainage_to      NUMERIC(10,3),
    stage            VARCHAR(100),
    quantity_lm      NUMERIC(12,3),
    quantity         NUMERIC(12,3),
    unit             VARCHAR(20),
    cost             NUMERIC(14,2),
    payment_qualifies BOOLEAN DEFAULT FALSE,
    approved         BOOLEAN DEFAULT FALSE,
    rejected         BOOLEAN DEFAULT FALSE,
    approved_by      VARCHAR(200),
    approved_at      TIMESTAMP,
    reject_reason    VARCHAR(500),
    contractor_name  VARCHAR(200),
    road_side        VARCHAR(10),
    rfi_number       INTEGER,
    layer_section    VARCHAR(50),
    created_at       TIMESTAMP DEFAULT NOW()
);

-- WhatsApp messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_number     VARCHAR(20),
    message_body    TEXT,
    media_id        VARCHAR(200),
    message_type    VARCHAR(20),
    parsed_activity VARCHAR(50),
    sdt_id          UUID REFERENCES site_data_transactions(id),
    timestamp       BIGINT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- GPS events
CREATE TABLE IF NOT EXISTS gps_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_code  VARCHAR(50),
    latitude        NUMERIC(10,7),
    longitude       NUMERIC(10,7),
    speed_kmh       NUMERIC(6,2),
    sdt_id          UUID REFERENCES site_data_transactions(id),
    timestamp       BIGINT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Equipment register
CREATE TABLE IF NOT EXISTS equipment_register (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    equipment_code  VARCHAR(50) UNIQUE NOT NULL,
    type            VARCHAR(100),
    make_model      VARCHAR(200),
    total_hours     NUMERIC(10,2) DEFAULT 0,
    total_fuel_litres NUMERIC(10,2) DEFAULT 0,
    status          VARCHAR(30) DEFAULT 'active'
);

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_code     VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(300) NOT NULL,
    category        VARCHAR(100),
    gstin           VARCHAR(20),
    contact         VARCHAR(50),
    approved        BOOLEAN DEFAULT FALSE
);

-- Work orders (M6 Nway integration)
CREATE TABLE IF NOT EXISTS work_orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    wo_number       VARCHAR(50) NOT NULL,
    contractor_name VARCHAR(200) NOT NULL,
    activity_code   VARCHAR(50),
    valid_from      DATE,
    valid_to        DATE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Daily reports header
CREATE TABLE IF NOT EXISTS daily_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    report_date     DATE NOT NULL,
    site_engineer   VARCHAR(200),
    weather         VARCHAR(100),
    observations    TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Material transactions
CREATE TABLE IF NOT EXISTS material_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    material_name   VARCHAR(300),
    unit            VARCHAR(20),
    quantity        NUMERIC(12,3),
    vendor_id       UUID REFERENCES vendors(id),
    transaction_type VARCHAR(20),
    date            DATE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Manpower timesheets
CREATE TABLE IF NOT EXISTS manpower_timesheets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    trade           VARCHAR(100),
    headcount       INTEGER,
    hours_worked    NUMERIC(6,2),
    report_date     DATE,
    site_engineer   VARCHAR(200),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Equipment daily log
CREATE TABLE IF NOT EXISTS equipment_daily_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    equipment_code  VARCHAR(50),
    report_date     DATE,
    hours_worked    NUMERIC(6,2),
    fuel_consumed_l NUMERIC(8,2),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Subcontractor progress
CREATE TABLE IF NOT EXISTS subcontractor_progress (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    subcontractor_name VARCHAR(300),
    activity_name   VARCHAR(300),
    quantity        NUMERIC(12,3),
    unit            VARCHAR(20),
    report_date     DATE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Design master
CREATE TABLE IF NOT EXISTS design_master (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    chainage_km     NUMERIC(10,3),
    chainage_label  VARCHAR(100),
    formation_rl_m  NUMERIC(10,3),
    subgrade_rl_m   NUMERIC(10,3),
    design_rl_m     NUMERIC(10,3),
    width_m         NUMERIC(8,3),
    cut_fill        VARCHAR(10),
    gsb_mm          NUMERIC(8,1),
    wmm_mm          NUMERIC(8,1),
    dbm_mm          NUMERIC(8,1),
    bc_mm           NUMERIC(8,1),
    source_file     VARCHAR(300)
);

-- Actual levels (survey readings)
CREATE TABLE IF NOT EXISTS actual_levels (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    chainage_km     NUMERIC(10,3),
    layer           VARCHAR(30),
    actual_rl_m     NUMERIC(10,3),
    survey_date     DATE,
    instrument_ref  VARCHAR(100),
    benchmark_rl_m  NUMERIC(10,3)
);

-- EVM snapshots
CREATE TABLE IF NOT EXISTS evm_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    snapshot_date   DATE,
    bcwp            NUMERIC(18,2),
    bcws            NUMERIC(18,2),
    acwp            NUMERIC(18,2),
    bac             NUMERIC(18,2),
    cpi             NUMERIC(6,3),
    spi             NUMERIC(6,3),
    eac             NUMERIC(18,2),
    etc             NUMERIC(18,2),
    pct_complete    NUMERIC(6,2),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Documents (S3 index)
CREATE TABLE IF NOT EXISTS documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    doc_number      VARCHAR(100) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    doc_type        VARCHAR(50),
    file_url        VARCHAR(1000),
    s3_key          VARCHAR(500),
    upload_date     TIMESTAMP DEFAULT NOW()
);
