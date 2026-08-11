TASK: Add Road Section and Road Side as admin-managed masters —
same pattern as Layers/Elements. Replace hardcoded ROAD_SIDES
arrays and free-text layer_section inputs with live API-fetched
dropdowns on both web and mobile.

Field name mapping (existing DB columns, no schema change needed):
  layer_section → stores Road Section value (rename label only)
  road_side     → stores Road Side value

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1 — Database: two new master tables
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create Alembic migration with two new tables:

  CREATE TABLE master_road_sections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50) UNIQUE NOT NULL,
    label       VARCHAR(150) NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMP DEFAULT now(),
    updated_at  TIMESTAMP DEFAULT now()
  );

  CREATE TABLE master_road_sides (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50) UNIQUE NOT NULL,
    label       VARCHAR(150) NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMP DEFAULT now(),
    updated_at  TIMESTAMP DEFAULT now()
  );

Seed data for master_road_sections (insert in migration):
  (MAIN_CARRIAGEWAY, Main Carriageway, 1)
  (SERVICE_ROAD, Service Road, 2)
  (SLIP_ROAD, Slip Road, 3)
  (RAMP, Ramp, 4)
  (LOOP, Loop, 5)
  (DIVERSION, Diversion, 6)
  (APPROACH_ROAD, Approach Road, 7)
  (SHOULDER, Shoulder, 8)
  (MEDIAN, Median, 9)
  (FOOTPATH, Footpath, 10)
  (CYCLE_TRACK, Cycle Track, 11)

Seed data for master_road_sides:
  (LHS, LHS, 1)
  (RHS, RHS, 2)
  (BOTH, Both, 3)
  (MEDIAN, Median, 4)
  (NA, NA, 5)

Run migration: alembic upgrade head

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — SQLAlchemy models
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: services/api/models/master_data.py

Add two new model classes following the exact same pattern as
MasterLayer:

  class MasterRoadSection(Base):
      __tablename__ = "master_road_sections"
      id         = Column(UUID(as_uuid=True), primary_key=True,
                          default=uuid.uuid4)
      code       = Column(String(50), unique=True, nullable=False)
      label      = Column(String(150), nullable=False)
      sort_order = Column(Integer, nullable=False, default=0)
      is_active  = Column(Boolean, nullable=False, default=True)
      created_at = Column(DateTime(timezone=True), server_default=func.now())
      updated_at = Column(DateTime(timezone=True), onupdate=func.now())

  class MasterRoadSide(Base):
      __tablename__ = "master_road_sides"
      # same column pattern as MasterRoadSection

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 3 — Pydantic schemas
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: services/api/schemas/master_data.py

Add response/create/update schemas for both, following the exact
same pattern as LayerResponse/LayerCreate/LayerUpdate:

  class RoadSectionResponse(BaseModel):
      code: str
      label: str
      sort_order: int = 0
      is_active: bool = True
      class Config: from_attributes = True

  class RoadSectionCreate(BaseModel):
      code: str
      label: str
      sort_order: int = 0

  class RoadSectionUpdate(BaseModel):
      label: Optional[str] = None
      sort_order: Optional[int] = None
      is_active: Optional[bool] = None

  # Same three classes for RoadSide (RoadSideResponse,
  # RoadSideCreate, RoadSideUpdate)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 4 — API endpoints
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: services/api/routers/master_data_router.py

Add 6 endpoints (GET list, POST create, PUT update) for each,
following the exact same pattern as the existing layers endpoints:

  @router.get("/road-sections", response_model=List[RoadSectionResponse])
  def list_road_sections(active_only: bool = True, db=...):
      q = db.query(MasterRoadSection)
      if active_only: q = q.filter(MasterRoadSection.is_active == True)
      return q.order_by(MasterRoadSection.sort_order).all()

  @router.post("/road-sections", response_model=RoadSectionResponse)
  def create_road_section(payload: RoadSectionCreate, db=..., user=...):
      require_admin(user)
      # same pattern as create_layer

  @router.put("/road-sections/{code}", response_model=RoadSectionResponse)
  def update_road_section(code: str, payload: RoadSectionUpdate, db=..., user=...):
      require_admin(user)
      # same pattern as update_layer

  # Same three endpoints for road-sides (/road-sides)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 5 — Masters UI (web)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: ekk-web/src/services/mastersService.js

Add API calls for both new masters, following the exact same
pattern as getLayers/createLayer/updateLayer:

  export const getRoadSections = (activeOnly = true) =>
    api.get('/api/masters/road-sections', { params: { active_only: activeOnly } })
       .then(r => r.data);
  export const createRoadSection = payload =>
    api.post('/api/masters/road-sections', payload).then(r => r.data);
  export const updateRoadSection = (code, payload) =>
    api.put(`/api/masters/road-sections/${code}`, payload).then(r => r.data);

  // Same three for road-sides (getRoadSides, createRoadSide,
  // updateRoadSide) hitting /api/masters/road-sides

FILE: ekk-web/src/pages/MastersPage.jsx

Add two new tabs "Road Sections" and "Road Sides" to the TABS
array, following the exact same pattern as the existing
"Layers" tab:

  const TABS = ['Work Types', 'Layers', 'Activities', 'Elements',
                'Structure Types', 'Road Sections', 'Road Sides',
                'Materials', 'Equipment', 'Manpower'];

Wire up data loading, form state, save handler, and table
rendering for both new tabs following the exact same pattern
as the Layers tab — same CRUD UI (label, sort_order, is_active
toggle), same form fields (Code, Label, Sort Order).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 6 — Web CaptureForm dropdowns
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: ekk-web/src/pages/CaptureForm.jsx

STEP A — Remove hardcoded ROAD_SIDES constant (line 17).

STEP B — Add API fetches for both masters on component mount,
alongside the existing masters loading:
  const [roadSections, setRoadSections] = useState([]);
  const [roadSides, setRoadSides]       = useState([]);

  // Inside the existing loadStaticMasters useEffect:
  const [rsData, rsdData] = await Promise.all([
    getRoadSections(),
    getRoadSides(),
  ]);
  setRoadSections(rsData);
  setRoadSides(rsdData);

STEP C — Replace the Road Side select (~line 691):
  Current: {ROAD_SIDES.map(s => <option key={s} value={s}>{s}</option>)}
  Replace: {roadSides.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}

STEP D — Replace the Layer Section free-text input (~line 696)
  with a Road Section dropdown, and rename the label:
  Current:
    <label>Layer Section</label>
    <input type="text" value={formData.layer_section} .../>

  Replace with:
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Road Section
    </label>
    <select value={formData.layer_section}
            onChange={e => updateField('layer_section', e.target.value)}
            className={sel}>
      <option value="">— Select —</option>
      {roadSections.map(s =>
        <option key={s.code} value={s.code}>{s.label}</option>)}
    </select>

  NOTE: field name stays layer_section — no DB or schema change
  needed, just the UI label and input type change.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 7 — Mobile: bulk-fetch + dropdowns
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: ekk-mobile/services/masters.js

Add two new cache keys and fetch calls following the exact same
pattern as every other master type:

  CACHE_KEYS:
    roadSections: 'masters_road_sections',
    roadSides:    'masters_road_sides',

  In fetchFromAPI() Promise.all, add:
    api.get('/api/masters/road-sections', { params: { active_only: true } }).then(r => r.data),
    api.get('/api/masters/road-sides',    { params: { active_only: true } }).then(r => r.data),

  In saveToCache, loadFromCache, getFallback: add both new fields
  with empty array fallbacks.

FILE: ekk-mobile/screens/CaptureScreen.js

STEP A — Remove hardcoded ROAD_SIDES array (find and delete it).

STEP B — Replace the road_side button selector (~line 1463) with
  a dropdown using masters.roadSides:
  Replace the .map over ROAD_SIDES with masters?.roadSides:
    {(masters?.roadSides ?? []).map(rs => (
      <TouchableOpacity key={rs.code}
        style={[styles.rsBtn, form.road_side === rs.code && styles.rsBtnActive]}
        onPress={() => update('road_side', rs.code)}>
        <Text style={[styles.rsBtnText,
          form.road_side === rs.code && styles.rsBtnTextActive]}>
          {rs.label}
        </Text>
      </TouchableOpacity>
    ))}

STEP C — Replace the layer_section free-text input (~line 1508)
  with a Road Section picker using masters.roadSections.
  Use the same picker pattern already used for other dropdowns
  in CaptureScreen (check how structure_type or element_code
  are rendered and use the same component/style pattern):
    Label: "Road Section" (not "Layer Section")
    Value: form.layer_section
    Options: masters?.roadSections ?? []
    Key/value: rs.code, label: rs.label

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEQUENCE: run parts in order 1→7
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After each part, verify before moving to the next:
  Part 1: alembic heads shows single head, seed data confirmed
  Part 2-4: docker-compose restart api → no startup errors
  Part 5: Masters UI shows Road Sections + Road Sides tabs,
          CRUD works for both
  Part 6: Web CaptureForm shows Road Section dropdown and
          Road Side dropdown (not free text, not hardcoded)
  Part 7: Mobile shows Road Section picker and Road Side
          buttons sourced from API (clear masters cache to
          force fresh fetch)

Report back after each part before proceeding to next.