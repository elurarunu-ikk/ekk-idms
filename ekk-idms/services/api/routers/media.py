# ekk-idms/routers/media.py
# Media upload router — local disk storage now, swap storage_backend for S3 later.
#
# To switch to S3 later, only change the `storage_backend.py` file.
# This router stays the same.

import uuid, os, shutil
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from auth import ensure_project_action, get_current_user
from models.site_data import SiteDataTransaction
from models.media import EntryMedia   # see migration below
from models.user import User

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────
MEDIA_ROOT   = os.path.join(os.path.dirname(__file__), '..', 'media_uploads')
MAX_PHOTOS   = 3
MAX_VIDEOS   = 1
MAX_PHOTO_MB = 5      # after client-side compression, still gate server-side
MAX_VIDEO_MB = 50     # 30-sec compressed video

ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
ALLOWED_VIDEO_TYPES = {'video/mp4', 'video/quicktime', 'video/x-m4v'}

os.makedirs(MEDIA_ROOT, exist_ok=True)


# ── Storage backend (swap this for S3 later) ──────────────────────────────────
def save_file(file_bytes: bytes, filename: str, subfolder: str) -> str:
    """Save to local disk. Returns relative URL path."""
    folder = os.path.join(MEDIA_ROOT, subfolder)
    os.makedirs(folder, exist_ok=True)
    dest = os.path.join(folder, filename)
    with open(dest, 'wb') as f:
        f.write(file_bytes)
    return f'/media/{subfolder}/{filename}'   # served as static


def delete_file(relative_url: str):
    """Delete from local disk."""
    path = os.path.join(MEDIA_ROOT, relative_url.replace('/media/', '', 1))
    if os.path.exists(path):
        os.remove(path)


# ── Upload endpoint ───────────────────────────────────────────────────────────
@router.post('/upload')
async def upload_media(
    entry_id:   str        = Form(...),
    media_type: str        = Form(...),    # 'photo' or 'video'
    file:       UploadFile = File(...),
    db:         Session    = Depends(get_db),
    user:       User       = Depends(get_current_user),
):
    # Validate entry exists
    try:
        eid = uuid.UUID(entry_id)
    except ValueError:
        raise HTTPException(400, 'Invalid entry_id')

    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == eid).first()
    if not entry:
        raise HTTPException(404, 'Entry not found')
    ensure_project_action(db, user, entry.project_id, 'capture', 'add')

    # Validate media type
    if media_type not in ('photo', 'video'):
        raise HTTPException(400, 'media_type must be photo or video')

    # Validate content type
    if media_type == 'photo' and file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, f'Invalid image type: {file.content_type}')
    if media_type == 'video' and file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(400, f'Invalid video type: {file.content_type}')

    # Check existing media count for this entry
    existing = db.query(EntryMedia).filter(
        EntryMedia.entry_id == eid,
        EntryMedia.media_type == media_type,
    ).count()

    if media_type == 'photo' and existing >= MAX_PHOTOS:
        raise HTTPException(400, f'Maximum {MAX_PHOTOS} photos per entry')
    if media_type == 'video' and existing >= MAX_VIDEOS:
        raise HTTPException(400, f'Maximum {MAX_VIDEOS} video per entry')

    # Read and size-check
    file_bytes = await file.read()
    size_mb = len(file_bytes) / (1024 * 1024)

    if media_type == 'photo' and size_mb > MAX_PHOTO_MB:
        raise HTTPException(400, f'Photo too large: {size_mb:.1f}MB (max {MAX_PHOTO_MB}MB)')
    if media_type == 'video' and size_mb > MAX_VIDEO_MB:
        raise HTTPException(400, f'Video too large: {size_mb:.1f}MB (max {MAX_VIDEO_MB}MB)')

    # Generate filename and save
    ext      = file.filename.split('.')[-1].lower() if file.filename else ('jpg' if media_type == 'photo' else 'mp4')
    filename = f'{eid}_{uuid.uuid4().hex[:8]}.{ext}'
    url      = save_file(file_bytes, filename, subfolder=str(eid))

    # Save record to DB
    media = EntryMedia(
        id         = uuid.uuid4(),
        entry_id   = eid,
        media_type = media_type,
        url        = url,
        size_mb    = round(size_mb, 2),
        filename   = filename,
    )
    db.add(media)
    db.commit()
    db.refresh(media)

    return {
        'id':         str(media.id),
        'entry_id':   str(eid),
        'media_type': media_type,
        'url':        url,
        'size_mb':    media.size_mb,
    }


# ── List media for an entry ───────────────────────────────────────────────────
@router.get('/entry/{entry_id}')
def list_media(
    entry_id: str,
    db:       Session = Depends(get_db),
    user:     User    = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(entry_id)
    except ValueError:
        raise HTTPException(400, 'Invalid entry_id')
    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == eid).first()
    if not entry:
        raise HTTPException(404, 'Entry not found')
    ensure_project_action(db, user, entry.project_id, 'capture', 'view')
    media = db.query(EntryMedia).filter(EntryMedia.entry_id == eid).all()
    return media


# ── Delete a media item ───────────────────────────────────────────────────────
@router.delete('/{media_id}')
def delete_media(
    media_id: str,
    db:       Session = Depends(get_db),
    user:     User    = Depends(get_current_user),
):
    try:
        mid = uuid.UUID(media_id)
    except ValueError:
        raise HTTPException(400, 'Invalid media_id')
    media = db.query(EntryMedia).filter(EntryMedia.id == mid).first()
    if not media:
        raise HTTPException(404, 'Media not found')
    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == media.entry_id).first()
    if not entry:
        raise HTTPException(404, 'Entry not found')
    ensure_project_action(db, user, entry.project_id, 'capture', 'delete')
    delete_file(media.url)
    db.delete(media)
    db.commit()
    return {'deleted': True, 'id': media_id}