#!/usr/bin/env python3
"""Render CUDA center-slice samples in the same minimal 3D view as HeatEngine."""

from pathlib import Path
import math
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "heat-frames.bin"
OUTPUT = ROOT / "assets" / "heat-simulation.gif"
WIDTH, HEIGHT = 780, 600


def smooth(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def palette():
    colors = [(4, 5, 11)] * 16
    colors[1] = (56, 97, 143)  # HeatEngine grid shader color.
    cold, warm, hot = (5, 15, 66), (13, 191, 255), (255, 26, 3)
    for i in range(240):
        t = i / 239.0
        colors.append(mix(mix(cold, warm, smooth(0.0, 0.35, t)), hot, smooth(0.35, 1.0, t)))
    return colors


PALETTE = palette()


def normalize(v):
    length = math.sqrt(sum(x * x for x in v))
    return tuple(x / length for x in v)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def camera(width, height, depth):
    yaw, pitch, distance = -0.65, 0.45, 3.2
    eye = (distance * math.cos(pitch) * math.sin(yaw), distance * math.sin(pitch), distance * math.cos(pitch) * math.cos(yaw))
    forward = normalize(tuple(-v for v in eye))
    right = normalize(cross(forward, (0.0, 1.0, 0.0)))
    up = cross(right, forward)
    f = 1.0 / math.tan(0.5 * 0.85)
    aspect = WIDTH / HEIGHT

    def project(point):
        relative = tuple(point[i] - eye[i] for i in range(3))
        cx, cy, cz = dot(relative, right), dot(relative, up), dot(relative, forward)
        if cz <= 0:
            return None
        return (round((f * cx / (aspect * cz) + 1.0) * WIDTH * 0.5),
                round((1.0 - f * cy / cz) * HEIGHT * 0.5))

    cell = 2.0 / max(width, height, depth)
    half = (width * cell * 0.5, height * cell * 0.5, depth * cell * 0.5)
    corners = [(-half[0], -half[1], -half[2]), (half[0], -half[1], -half[2]),
               (half[0], half[1], -half[2]), (-half[0], half[1], -half[2]),
               (-half[0], -half[1], half[2]), (half[0], -half[1], half[2]),
               (half[0], half[1], half[2]), (-half[0], half[1], half[2])]
    projected = [project(p) for p in corners]
    edges = ((0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4),
             (0, 4), (1, 5), (2, 6), (3, 7))
    return project, cell, projected, edges


def set_pixel(canvas, x, y, color):
    if 0 <= x < WIDTH and 0 <= y < HEIGHT:
        canvas[y * WIDTH + x] = color


def draw_line(canvas, a, b, color):
    if a is None or b is None:
        return
    x0, y0 = a
    x1, y1 = b
    dx, sx = abs(x1 - x0), 1 if x0 < x1 else -1
    dy, sy = -abs(y1 - y0), 1 if y0 < y1 else -1
    error = dx + dy
    while True:
        set_pixel(canvas, x0, y0, color)
        if x0 == x1 and y0 == y1:
            break
        twice = 2 * error
        if twice >= dy:
            error += dy
            x0 += sx
        if twice <= dx:
            error += dx
            y0 += sy


def draw_frame(values, width, height, depth, slice_z):
    canvas = bytearray(WIDTH * HEIGHT)  # Same near-black clear color as the OpenGL viewer.
    project, cell, corners, edges = camera(width, height, depth)

    # The simple wireframe is the simulation volume already drawn by HeatEngine.
    for a, b in edges:
        draw_line(canvas, corners[a], corners[b], 1)

    # Reproduce the live renderer's point grid and exact heat.frag color mapping.
    z = (slice_z + 0.5 - depth * 0.5) * cell
    point_size = 3
    half_point = point_size // 2
    for y in range(height):
        world_y = (y + 0.5) * cell - height * cell * 0.5
        for x in range(width):
            world_x = (x + 0.5) * cell - width * cell * 0.5
            screen = project((world_x, world_y, z))
            if screen is None:
                continue
            temperature = values[y * width + x]
            color = 16 + int(max(0.0, min(1.0, temperature * 18.0)) * 239.0 + 0.5)
            sx, sy = screen
            for py in range(sy - half_point, sy + half_point + 1):
                for px in range(sx - half_point, sx + half_point + 1):
                    set_pixel(canvas, px, py, color)
    return canvas


def pack_lzw(indices):
    clear, end = 256, 257
    dictionary, next_code = {}, 258
    output = bytearray()
    bits, bit_count = 0, 0

    def emit(code):
        nonlocal bits, bit_count
        bits |= code << bit_count
        bit_count += 9
        while bit_count >= 8:
            output.append(bits & 255)
            bits >>= 8
            bit_count -= 8

    emit(clear)
    prefix = indices[0]
    for symbol in indices[1:]:
        key = (prefix, symbol)
        found = dictionary.get(key)
        if found is not None:
            prefix = found
            continue
        emit(prefix)
        if next_code < 500:
            dictionary[key] = next_code
            next_code += 1
        else:
            emit(clear)
            dictionary.clear()
            next_code = 258
        prefix = symbol
    emit(prefix)
    emit(end)
    if bit_count:
        output.append(bits & 255)
    return output


def write_blocks(file, data):
    for start in range(0, len(data), 255):
        block = data[start:start + 255]
        file.write(bytes((len(block),)))
        file.write(block)
    file.write(b"\0")


def write_gif(frames):
    with OUTPUT.open("wb") as gif:
        gif.write(b"GIF89a")
        gif.write(struct.pack("<HHBBB", WIDTH, HEIGHT, 0xF7, 0, 0))
        gif.write(bytes(c for rgb in PALETTE for c in rgb))
        gif.write(b"!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00")
        for frame in frames:
            gif.write(b"!\xf9\x04\x08\x06\x00\x00\x00")
            gif.write(b",\x00\x00\x00\x00")
            gif.write(struct.pack("<HHB", WIDTH, HEIGHT, 0))
            gif.write(b"\x08")
            write_blocks(gif, pack_lzw(frame))
        gif.write(b";")


def main():
    raw = SOURCE.read_bytes()
    width, height, depth, slice_z, frame_count, steps = struct.unpack_from("<6I", raw)
    count = width * height
    expected_size = 24 + frame_count * count * 4
    if len(raw) != expected_size:
        raise SystemExit(f"Unexpected CUDA frame data size: {len(raw)} bytes; expected {expected_size}")
    samples, offset = [], 24
    for _ in range(frame_count):
        samples.append(struct.unpack_from(f"<{count}f", raw, offset))
        offset += count * 4
    frames = [draw_frame(field, width, height, depth, slice_z) for field in samples]
    # The mirrored playback makes the end of the loop meet its beginning cleanly.
    write_gif(frames + frames[-2:0:-1])
    print(f"Wrote clean simulation view: {OUTPUT} ({len(frames) * 2 - 2} frames, {WIDTH}x{HEIGHT}, CUDA samples every {steps} steps).")


if __name__ == "__main__":
    main()
