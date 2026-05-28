"""
Unit tests for voice_parser.py

Run with:  pytest services/api/tests/test_voice_parser.py -v
"""

import sys
import os

# Make the api package importable when running from repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from voice_parser import parse_voice_transcript, normalise_unit


# ── normalise_unit ─────────────────────────────────────────────────────────────

class TestNormaliseUnit:
    def test_cum_variants(self):
        assert normalise_unit("cubic meter") == "CUM"
        assert normalise_unit("cum") == "CUM"
        assert normalise_unit("CUM") == "CUM"
        assert normalise_unit("cmt") == "CUM"

    def test_metric_ton(self):
        assert normalise_unit("ton") == "MT"
        assert normalise_unit("tonne") == "MT"
        assert normalise_unit("metric ton") == "MT"

    def test_linear(self):
        assert normalise_unit("rm") == "LM"
        assert normalise_unit("running meter") == "LM"

    def test_unknown_passthrough(self):
        assert normalise_unit("LITRE") == "LTR"
        assert normalise_unit("nos") == "NOS"


# ── empty / trivial inputs ─────────────────────────────────────────────────────

class TestEmptyInputs:
    def test_empty_string(self):
        result = parse_voice_transcript("")
        assert result["confidence"] == 0.0
        assert result["materials"] == []
        assert result["machines"] == []
        assert result["manpower"] == []

    def test_whitespace_only(self):
        result = parse_voice_transcript("   ")
        assert result["confidence"] == 0.0

    def test_none_handled(self):
        result = parse_voice_transcript(None)  # type: ignore[arg-type]
        assert result["confidence"] == 0.0


# ── material extraction ────────────────────────────────────────────────────────

class TestMaterialExtraction:
    def test_wmm_with_quantity_and_unit(self):
        result = parse_voice_transcript("45 cum WMM from crusher")
        mats = result["materials"]
        assert any(m["material_code"] == "WMM" for m in mats)
        wmm = next(m for m in mats if m["material_code"] == "WMM")
        assert wmm["quantity"] == 45.0
        assert wmm["unit"] == "CUM"

    def test_gsb_tonne(self):
        result = parse_voice_transcript("GSB 30 ton from quarry")
        mats = result["materials"]
        gsb = next((m for m in mats if m["material_code"] == "GSB"), None)
        assert gsb is not None
        assert gsb["quantity"] == 30.0
        assert gsb["unit"] == "MT"

    def test_cement_bags(self):
        result = parse_voice_transcript("cement 10 bags")
        mats = result["materials"]
        cement = next((m for m in mats if m["material_code"] == "CEMENT"), None)
        assert cement is not None
        assert cement["quantity"] == 10.0
        assert cement["unit"] == "BAG"

    def test_source_extraction(self):
        result = parse_voice_transcript("45 cum WMM from crusher")
        mats = result["materials"]
        wmm = next((m for m in mats if m["material_code"] == "WMM"), None)
        assert wmm is not None
        assert wmm.get("source") == "Crusher"

    def test_multiple_materials(self):
        result = parse_voice_transcript("45 cum WMM and 10 ton bitumen")
        codes = {m["material_code"] for m in result["materials"]}
        assert "WMM" in codes
        assert "BITUMEN" in codes

    def test_hindi_mixed_material(self):
        result = parse_voice_transcript("WMM 45 cum lagaya")
        mats = result["materials"]
        assert any(m["material_code"] == "WMM" for m in mats)

    def test_confidence_with_material(self):
        result = parse_voice_transcript("45 cum WMM from crusher")
        assert result["confidence"] >= 0.3


# ── machine extraction ────────────────────────────────────────────────────────

class TestMachineExtraction:
    def test_roller_with_hours(self):
        result = parse_voice_transcript("roller 8 hours")
        machines = result["machines"]
        roller = next((m for m in machines if m["machine_code"] == "ROLLER"), None)
        assert roller is not None
        assert roller["hours"] == 8.0

    def test_hindi_hours(self):
        result = parse_voice_transcript("roller aath ghante")
        machines = result["machines"]
        roller = next((m for m in machines if m["machine_code"] == "ROLLER"), None)
        assert roller is not None
        assert roller["hours"] == 8.0

    def test_operator_name(self):
        result = parse_voice_transcript("roller 6 hours operator Ravi")
        machines = result["machines"]
        roller = next((m for m in machines if m["machine_code"] == "ROLLER"), None)
        assert roller is not None
        assert roller.get("operator_name") == "Ravi"

    def test_paver_extraction(self):
        result = parse_voice_transcript("paver 4 hours")
        machines = result["machines"]
        assert any(m["machine_code"] == "PAVER" for m in machines)

    def test_multiple_machines(self):
        result = parse_voice_transcript("roller 8 hours, paver 4 hours, tipper 6 hours")
        codes = {m["machine_code"] for m in result["machines"]}
        assert "ROLLER" in codes
        assert "PAVER" in codes
        assert "TIPPER" in codes

    def test_jcb_alias(self):
        result = parse_voice_transcript("jcb 5 hours")
        machines = result["machines"]
        assert any(m["machine_code"] == "EXCAVATOR" for m in machines)


# ── manpower extraction ───────────────────────────────────────────────────────

class TestManpowerExtraction:
    def test_skilled_count(self):
        result = parse_voice_transcript("12 skilled workers day shift")
        mp = result["manpower"]
        skilled = next((m for m in mp if m["category"] == "SKILLED"), None)
        assert skilled is not None
        assert skilled["count"] == 12
        assert skilled["shift_type"] == "DAY"

    def test_mazdoor_hindi(self):
        result = parse_voice_transcript("8 mazdoor")
        mp = result["manpower"]
        assert any(m["category"] == "UNSKILLED" for m in mp)

    def test_night_shift(self):
        result = parse_voice_transcript("5 mason night shift")
        mp = result["manpower"]
        mason = next((m for m in mp if m["category"] == "MASON"), None)
        assert mason is not None
        assert mason["shift_type"] == "NIGHT"

    def test_hindi_number_count(self):
        result = parse_voice_transcript("teen mason")
        mp = result["manpower"]
        mason = next((m for m in mp if m["category"] == "MASON"), None)
        assert mason is not None
        assert mason["count"] == 3

    def test_operator_category(self):
        result = parse_voice_transcript("2 operator day shift")
        mp = result["manpower"]
        assert any(m["category"] == "OPERATOR" for m in mp)


# ── full Hindi/English mixed sentences ───────────────────────────────────────

class TestHindiEnglishMix:
    def test_full_mixed_sentence(self):
        result = parse_voice_transcript(
            "WMM 45 cum lagaya, roller aath ghante, 12 mazdoor day shift"
        )
        assert any(m["material_code"] == "WMM" for m in result["materials"])
        assert any(m["machine_code"] == "ROLLER" for m in result["machines"])
        assert any(m["category"] == "UNSKILLED" for m in result["manpower"])
        assert result["confidence"] > 0.5

    def test_english_only(self):
        result = parse_voice_transcript(
            "45 cubic meter GSB from crusher, compactor 6 hours operator Ravi, 8 skilled workers"
        )
        assert any(m["material_code"] == "GSB" for m in result["materials"])
        assert any(m["machine_code"] == "COMPACTOR" for m in result["machines"])
        assert any(m["category"] == "SKILLED" for m in result["manpower"])

    def test_hindi_number_machine_hours(self):
        result = parse_voice_transcript("compactor chhe ghante")
        machines = result["machines"]
        comp = next((m for m in machines if m["machine_code"] == "COMPACTOR"), None)
        assert comp is not None
        assert comp["hours"] == 6.0


# ── confidence scoring ─────────────────────────────────────────────────────────

class TestConfidenceScore:
    def test_no_entities_zero_confidence(self):
        result = parse_voice_transcript("the weather is sunny today")
        assert result["confidence"] == 0.0

    def test_one_entity_partial_confidence(self):
        result = parse_voice_transcript("roller used")
        assert 0.0 < result["confidence"] < 0.8

    def test_full_3m_high_confidence(self):
        result = parse_voice_transcript(
            "WMM 45 cum lagaya, roller aath ghante operator Ravi, 12 mazdoor day shift"
        )
        assert result["confidence"] >= 0.5

    def test_confidence_between_0_and_1(self):
        for transcript in [
            "45 cum WMM from crusher, roller 8 hours, 12 skilled workers day shift",
            "cement 5 bags",
            "jcb 3 hours",
            "10 mazdoor",
            "",
        ]:
            result = parse_voice_transcript(transcript)
            assert 0.0 <= result["confidence"] <= 1.0, (
                f"Confidence out of range for: {transcript!r}"
            )

    def test_raw_transcript_preserved(self):
        text = "WMM 45 cum lagaya"
        result = parse_voice_transcript(text)
        assert result["raw"] == text
