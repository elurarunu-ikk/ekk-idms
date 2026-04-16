# Phase 1 Build Order — EKK IDMS

## Priority: Field Data Capture → Nway Export

### Week 1-2: Foundation
- [ ] Run 01_init_schema.sql on PostgreSQL
- [ ] Run seeds
- [ ] Test /health endpoint
- [ ] Test /auth/login endpoint
- [ ] Implement M5 discipline_router (needed by all capture forms)

### Week 2-3: M1 Capture (WhatsApp first)
- [ ] WhatsApp webhook verification (GET /api/capture/whatsapp)
- [ ] WhatsApp inbound message parse (POST /api/capture/whatsapp)
- [ ] Manual browser capture (POST /api/capture/manual)
- [ ] Approval queue (GET /api/capture/pending, PATCH approve/reject)

### Week 3-4: M2 Conversion
- [ ] Load conversion factors (GET /api/compute/factors)
- [ ] LM→m3/MT conversion (POST /api/compute/convert)
- [ ] Record progress (POST /api/compute/record-progress)
- [ ] EVM metrics (GET /api/compute/evm)

### Week 4-5: M4 Daily Entry
- [ ] References endpoint (GET /api/manual/references)
- [ ] Progress entry (POST /api/manual/progress)
- [ ] Material / Manpower / Equipment / Subcon entries
- [ ] Batch submit (POST /api/manual/submit-day)

### Week 5-6: M6 Nway Export
- [ ] Work orders CRUD (/api/export/workorders)
- [ ] Nway DPR export (GET /api/export/nway-dpr)
- [ ] Test with billing team against Nway import

### Week 6+: Frontend + BI
- [ ] CaptureScreen.jsx (WhatsApp + manual form)
- [ ] ManualEntry.jsx (5-section daily report)
- [ ] NwayExport.jsx (billing export screen)
- [ ] WorkOrderAdmin.jsx
- [ ] Metabase dashboards: daily progress, EVM, contractor-wise

## Phase 2 (after Phase 1 stable)
- Video/photo AI activity detection
- Drone ODM integration
- Voice-to-text via WhatsApp audio
- M3 Design master + NCR reports
- RAG document query
