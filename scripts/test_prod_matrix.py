import urllib.request
import json
import time
import sys
import ssl

sys.stdout.reconfigure(encoding='utf-8')

PROD_URL = "https://skibidi-mp3.sebastien-gratade.fr"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

TEST_CASES = [
    {
        "platform": "YouTube",
        "type": "Video MP4",
        "format": "mp4",
        "url": "https://www.youtube.com/watch?v=M2Wfy9Wj8-M",
    },
    {
        "platform": "YouTube",
        "type": "Audio MP3",
        "format": "mp3",
        "url": "https://www.youtube.com/watch?v=M2Wfy9Wj8-M",
    },
    {
        "platform": "Spotify",
        "type": "Audio MP3 Track",
        "format": "mp3",
        "url": "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
    },
    {
        "platform": "Spotify",
        "type": "Album Multi-Tracks",
        "format": "mp3",
        "url": "https://open.spotify.com/album/3mkVo55KYmJAxy21rPssZ4",
    },
    {
        "platform": "SoundCloud",
        "type": "Audio MP3",
        "format": "mp3",
        "url": "https://soundcloud.com/postmalone/circles",
    },
    {
        "platform": "Vimeo",
        "type": "Video MP4",
        "format": "mp4",
        "url": "https://vimeo.com/22439234",
    },
    {
        "platform": "Pinterest",
        "type": "Image PNG HD",
        "format": "png",
        "url": "https://www.pinterest.com/pin/123456789/",
    }
]

print("=" * 80)
print(f"🚀  MATRICE DE TESTS DES TÉLÉCHARGEMENTS SUR {PROD_URL}")
print("=" * 80)

results = []

for idx, test in enumerate(TEST_CASES, start=1):
    platform = test["platform"]
    t_type = test["type"]
    target_url = test["url"]
    fmt = test["format"]
    
    print(f"\n[{idx}/{len(TEST_CASES)}] Test {platform} ({t_type})...")
    print(f"     URL: {target_url}")
    
    start_t = time.time()
    
    # Step 1: /api/info
    info_url = f"{PROD_URL}/api/info"
    info_payload = json.dumps({"url": target_url}).encode("utf-8")
    
    try:
        req = urllib.request.Request(
            info_url,
            data=info_payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
        )
        with urllib.request.urlopen(req, context=ctx, timeout=30) as res:
            info_data = json.loads(res.read().decode("utf-8"))
            title = info_data.get("title", "Titre Inconnu")
            print(f"     ✓ /api/info OK: '{title[:45]}...' ({info_data.get('platform')})")
    except Exception as e:
        dur = round(time.time() - start_t, 2)
        print(f"     ❌ /api/info Échoué: {e}")
        results.append({
            "platform": platform,
            "type": t_type,
            "status": "FAIL (Info)",
            "size": "0 Ko",
            "duration": f"{dur}s",
            "error": str(e)
        })
        continue

    # Step 2: /api/download
    dl_url = f"{PROD_URL}/api/download"
    dl_payload = json.dumps({
        "url": info_data.get("url") or target_url,
        "format": fmt,
        "metadata": {
            "title": info_data.get("title", "Test"),
            "artist": info_data.get("artist", "Test Artist"),
            "coverUrl": info_data.get("thumbnail") or info_data.get("imageUrl")
        }
    }).encode("utf-8")

    try:
        req_dl = urllib.request.Request(
            dl_url,
            data=dl_payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
        )
        with urllib.request.urlopen(req_dl, context=ctx, timeout=60) as res_dl:
            content = res_dl.read()
            size_kb = len(content) // 1024
            dur = round(time.time() - start_t, 2)
            content_type = res_dl.headers.get("Content-Type", "application/octet-stream")
            print(f"     ✓ /api/download OK: {size_kb} Ko reçus en {dur}s ({content_type})")
            results.append({
                "platform": platform,
                "type": t_type,
                "status": "SUCCESS",
                "size": f"{size_kb} Ko",
                "duration": f"{dur}s",
                "error": "-"
            })
    except urllib.error.HTTPError as e:
        dur = round(time.time() - start_t, 2)
        err_msg = e.read().decode("utf-8", errors="replace")[:120]
        print(f"     ❌ /api/download HTTP {e.code}: {err_msg}")
        results.append({
            "platform": platform,
            "type": t_type,
            "status": f"FAIL (HTTP {e.code})",
            "size": "0 Ko",
            "duration": f"{dur}s",
            "error": err_msg
        })
    except Exception as e:
        dur = round(time.time() - start_t, 2)
        print(f"     ❌ /api/download Échoué: {e}")
        results.append({
            "platform": platform,
            "type": t_type,
            "status": "FAIL",
            "size": "0 Ko",
            "duration": f"{dur}s",
            "error": str(e)[:120]
        })

print("\n" + "=" * 80)
print("📊  TABLEAU RÉCAPITULATIF DES TESTS")
print("=" * 80)
print(f"{'Plateforme':<15} | {'Type':<20} | {'Statut':<12} | {'Taille':<10} | {'Durée':<8} | {'Détails'}")
print("-" * 80)
for r in results:
    status_icon = "🟢" if "SUCCESS" in r["status"] else "🔴"
    print(f"{r['platform']:<15} | {r['type']:<20} | {status_icon} {r['status']:<9} | {r['size']:<10} | {r['duration']:<8} | {r['error']}")
print("=" * 80)
