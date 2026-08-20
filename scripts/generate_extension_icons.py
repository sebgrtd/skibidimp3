import os
import struct
import zlib
import math

def create_png(size):
    width = size
    height = size
    raw_data = bytearray()
    
    cx = size / 2.0
    cy = size / 2.0
    radius = size / 2.0
    
    for y in range(height):
        raw_data.append(0) # Filter byte (0 = None)
        for x in range(width):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            
            if dist <= radius - 0.5:
                t = (x + y) / (width + height)
                r = int(139 * (1 - t) + 6 * t)
                g = int(92 * (1 - t) + 182 * t)
                b = int(246 * (1 - t) + 212 * t)
                
                nx = (x - cx) / (radius * 0.65)
                ny = (y - cy) / (radius * 0.65)
                
                is_symbol = False
                if -0.3 <= nx <= 0.3 and -0.6 <= ny <= 0.6:
                    if ny < 0 and nx >= -0.2 - ny * 0.3 and nx <= 0.3 - ny * 0.2:
                        is_symbol = True
                    if ny >= 0 and nx >= -0.3 - ny * 0.2 and nx <= 0.2 - ny * 0.3:
                        is_symbol = True
                
                if is_symbol:
                    raw_data.extend([255, 255, 255, 255])
                else:
                    raw_data.extend([r, g, b, 255])
            else:
                raw_data.extend([0, 0, 0, 0])
                
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        crc = zlib.crc32(tag + data) & 0xffffffff
        return c + struct.pack(">I", crc)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw_data), level=9)
    
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

out_dir = os.path.join(os.path.dirname(__file__), "..", "chrome-extension", "icons")
os.makedirs(out_dir, exist_ok=True)

for s in [16, 32, 48, 128]:
    png_bytes = create_png(s)
    with open(os.path.join(out_dir, f"icon{s}.png"), "wb") as f:
        f.write(png_bytes)
    print(f"Created icon{s}.png ({len(png_bytes)} bytes)")
