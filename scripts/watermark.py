"""
Uklanja DomoAI watermark (logo gore levo + poluprovidan natpis "DomoAI" sa
senkom) iz frejmova koje daje DomoAI besplatni tier (864x496).

Model watermarka (domoai_watermark.npz) je izveden jednom iz postojecih klipova:
- logo: pikseli koji ostaju isti dok kamera panuje (golf klip)
- natpis + senka: izmereni na glatkom nebu (audi klip) kao Y = k*B + c,
  gde je B originalna pozadina — ovde se to obrne: B = (Y - c) / k

Logo je neproziran pa ne moze da se "obrne": popunjava se najslicnijim komadom
pozadine (iz istog ili susednog frejma, posto se kamera pomera) uz Poisson
stapanje ivica, a ako nema dobrog poklapanja — glatkom interpolacijom.

Koristi ga extract_sequence.py kad se pozove sa --bez-watermarka.
"""

import os
import cv2
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "domoai_watermark.npz")
NEIGHBOR_OFFSETS = (-12, -8, -4, 4, 8, 12)  # susedni frejmovi (12fps) kao izvor pozadine za logo
MAX_MATCH_ERROR = 150  # prosecna kvadratna greska po pikselu; iznad toga -> glatka interpolacija
SEARCH_PAD = 10


def load_model():
    m = np.load(MODEL_PATH)
    model = {key: m[key] for key in m.files}
    oy, ox = model["origin"]
    ch, cw = model["k"].shape
    model["box"] = (slice(oy, oy + ch), slice(ox, ox + cw))
    return model


def _ellipse(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def harmonic_fill(img, mask, iters=1200):
    """Popuni maskirane piksele Laplace interpolacijom sa ivice (gradijent neba ostaje gladak)."""
    out = img.astype(np.float64)
    ys, xs = np.nonzero(mask)
    y0, y1 = max(ys.min() - 2, 0), ys.max() + 3
    x0, x1 = max(xs.min() - 2, 0), xs.max() + 3
    crop = out[y0:y1, x0:x1]
    m = mask[y0:y1, x0:x1]
    crop[m] = crop[~m].mean(axis=0)
    for _ in range(iters):
        avg = 0.25 * (np.roll(crop, 1, 0) + np.roll(crop, -1, 0) + np.roll(crop, 1, 1) + np.roll(crop, -1, 1))
        crop[m] = avg[m]
    return out


def remove_text(frame, model):
    """Obrne poluprovidan beli natpis i tamnu senku: B = (Y - c) / k."""
    box = model["box"]
    text, glyph = model["text"], model["glyph"]
    k = np.where(text, model["k"], 1.0).astype(np.float64)
    c = np.where(text, model["c"], 0.0).astype(np.float64)

    out = frame.copy()
    ycc = cv2.cvtColor(frame[box], cv2.COLOR_BGR2YCrCb).astype(np.float64)
    k_chroma = cv2.GaussianBlur(k, (0, 0), 1.0)  # hroma je u videu na pola rezolucije
    ycc[..., 0] = (ycc[..., 0] - c) / k
    ycc[..., 1:] = 128 + (ycc[..., 1:] - 128) / k_chroma[..., None]

    # ostatak ivica slova (kompresija) svedi na opseg okolnih "cistih" piksela
    win = np.ones((9, 9), np.uint8)
    for ch in range(3):
        v = ycc[..., ch]
        lo = cv2.erode(np.where(glyph, 255.0, v).astype(np.float32), win)
        hi = cv2.dilate(np.where(glyph, 0.0, v).astype(np.float32), win)
        ycc[..., ch] = np.where(glyph & (lo <= hi), np.clip(v, lo, hi), v)

    out[box] = cv2.cvtColor(np.clip(ycc, 0, 255).astype(np.uint8), cv2.COLOR_YCrCb2BGR)
    return out


def _logo_window(model):
    oy, ox = model["origin"]
    ys, xs = np.nonzero(model["logo"])
    y0, y1 = oy + ys.min() - SEARCH_PAD, oy + ys.max() + SEARCH_PAD + 1
    x0, x1 = ox + xs.min() - SEARCH_PAD, ox + xs.max() + SEARCH_PAD + 1
    full = np.zeros(tuple(model["frame_size"]), bool)
    full[model["box"]] = model["logo"]
    guard = np.zeros_like(full)
    guard[model["box"]] = cv2.dilate((model["logo"] | model["text"]).astype(np.uint8), _ellipse(3)) > 0
    return (y0, y1, x0, x1), full[y0:y1, x0:x1], guard


def fill_logo(frame, sources, model):
    """Prekrij logo najslicnijim komadom pozadine iz `sources` (Poisson stapanje ivica)."""
    (y0, y1, x0, x1), fill, guard = _logo_window(model)
    h, w = fill.shape
    tmask = np.dstack([(~guard[y0:y1, x0:x1]).astype(np.float32)] * 3)
    templ = frame[y0:y1, x0:x1].astype(np.float32)
    gy, gx = np.nonzero(guard)
    fy0, fy1 = max(gy.min() - h + 1, 0), gy.max() + 1
    fx0, fx1 = max(gx.min() - w + 1, 0), gx.max() + 1

    best = None
    for src in sources:
        res = cv2.matchTemplate(src.astype(np.float32), templ, cv2.TM_SQDIFF, mask=tmask)
        res[fy0:fy1, fx0:fx1] = np.inf  # izvor ne sme da preklapa sam watermark
        res[~np.isfinite(res)] = np.inf
        yy, xx = np.unravel_index(np.argmin(res), res.shape)
        err = res[yy, xx] / tmask.sum()
        if best is None or err < best[0]:
            best = (err, src[yy:yy + h, xx:xx + w].astype(np.float64))

    out = frame.astype(np.float64)
    dst = out[y0:y1, x0:x1]
    if best[0] <= MAX_MATCH_ERROR:
        src_win = best[1]
        correction = harmonic_fill(dst - src_win, fill)
        dst[fill] = (src_win + correction)[fill]
    else:
        dst[fill] = harmonic_fill(dst, fill)[fill]
    return np.clip(out, 0, 255).astype(np.uint8)


def remove_domoai_watermark(frames):
    """Vraca nove frejmove bez watermarka. `frames` su BGR uint8 slike istog klipa, redom."""
    model = load_model()
    expected = tuple(model["frame_size"])
    if frames and frames[0].shape[:2] != expected:
        raise ValueError(
            f"Watermark model je za {expected[1]}x{expected[0]} frejmove, a klip je "
            f"{frames[0].shape[1]}x{frames[0].shape[0]} — watermark se ne moze automatski ukloniti."
        )
    no_text = [remove_text(f, model) for f in frames]
    cleaned = []
    for i, f in enumerate(no_text):
        neighbors = [frames[i + d] for d in NEIGHBOR_OFFSETS if 0 <= i + d < len(frames)]
        cleaned.append(fill_logo(f, [f] + neighbors, model))
    return cleaned
