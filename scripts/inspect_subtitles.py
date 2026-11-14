import urllib.request
import re

embed_url = 'https://v13.streamvsmov.com/video/b1857bac-3f89-4cf2-a968-39a93bea597b'
req = urllib.request.Request(embed_url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        html = r.read().decode('utf-8', errors='ignore')
        print(f"Embed HTML length: {len(html)}")
        
        # Look for tracks
        for m in re.finditer(r'tracks\s*:\s*(\[.*?\])', html, re.DOTALL):
            print("Found tracks block:", m.group(1))

        # Look for vtt/srt
        subs = re.findall(r'https?://[^\s\'"]+\.(?:vtt|srt|m3u8)', html)
        print("Found media/subtitle URLs in embed:", subs)

        # Print all script tags content snippet
        scripts = re.findall(r'<script>(.*?)</script>', html, re.DOTALL)
        for i, s in enumerate(scripts):
            print(f"--- Script {i} ---")
            print(s[:600])
except Exception as e:
    print("Embed error:", e)

m3u8_url = 'https://v13.streamvsmov.com/stream/b1857bac-3f89-4cf2-a968-39a93bea597b/master.m3u8'
req2 = urllib.request.Request(m3u8_url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req2, timeout=10) as r2:
        m3u8_text = r2.read().decode('utf-8', errors='ignore')
        print("--- Master M3U8 Content ---")
        print(m3u8_text)
except Exception as e:
    print("M3U8 error:", e)
