"""Blender render worker for blockbench-new-model deliverables.

Run inside Blender, after the .blend and before ``-a``:

    blender -b scene.blend --python-exit-code 1 -P render_worker.py -a -- --gpu 0 --out frames
    blender -b scene.blend -P render_worker.py -- --list-devices

Several workers may render the same frame range at once, one per GPU. Each
worker skips frames that already exist and writes an empty placeholder when it
starts a frame, so the workers share the range without coordination and a rerun
resumes where the last one stopped. A worker that crashes leaves a 0-byte
placeholder behind; delete those files and run again to fill the gaps.

Options (after ``--``):
    --gpu N|all|cpu   Render on GPU N only (default), every GPU, or the CPU.
    --out DIR         Frame directory; frames are written as frame_####.png.
    --samples N       Override Cycles samples (keeps the scene value when omitted).
    --list-devices    Print one JSON line describing the GPUs and exit.
"""

import argparse
import json
import os
import sys

import bpy

BACKENDS = ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL")


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(prog="render_worker.py")
    parser.add_argument("--gpu", default="0")
    parser.add_argument("--out", default="")
    parser.add_argument("--samples", type=int, default=0)
    parser.add_argument("--list-devices", action="store_true")
    return parser.parse_args(argv)


def cycles_prefs():
    return bpy.context.preferences.addons["cycles"].preferences


def gpu_devices(prefs, backend):
    """Return the GPUs Cycles exposes for one backend, in a stable order."""
    try:
        prefs.compute_device_type = backend
    except TypeError:
        return []
    prefs.get_devices()
    return [d for d in prefs.devices if d.type == backend]


def pick_backend(prefs):
    """First backend with at least one GPU, preferring OptiX on NVIDIA."""
    found = [(b, gpu_devices(prefs, b)) for b in BACKENDS]
    usable = [(b, devs) for b, devs in found if devs]
    if not usable:
        return None, []
    backend, devices = usable[0]
    prefs.compute_device_type = backend
    prefs.get_devices()
    return backend, devices


def list_devices():
    backend, devices = pick_backend(cycles_prefs())
    print("DEVICES_JSON " + json.dumps({"backend": backend, "gpus": [d.name for d in devices]}))


def configure_device(scene, gpu):
    prefs = cycles_prefs()
    if gpu == "cpu":
        scene.cycles.device = "CPU"
        return "CPU"
    backend, devices = pick_backend(prefs)
    if not devices:
        scene.cycles.device = "CPU"
        return "CPU (no GPU backend found)"
    if gpu != "all" and not (gpu.isdigit() and int(gpu) < len(devices)):
        raise SystemExit(f"--gpu {gpu} is not one of 0-{len(devices) - 1}, all or cpu ({backend})")
    wanted = range(len(devices)) if gpu == "all" else [int(gpu)]
    for index, device in enumerate(devices):
        device.use = index in wanted
    for device in prefs.devices:
        if device.type == "CPU":
            device.use = False
    scene.cycles.device = "GPU"
    return f"{backend}: " + ", ".join(devices[i].name for i in wanted)


def configure_output(scene, out_dir, samples):
    render = scene.render
    render.image_settings.file_format = "PNG"
    render.image_settings.color_mode = "RGBA" if render.film_transparent else "RGB"
    render.image_settings.color_depth = "8"
    render.filepath = os.path.join(os.path.abspath(out_dir), "frame_####")
    render.use_file_extension = True
    render.use_overwrite = False
    render.use_placeholder = True
    render.use_persistent_data = True
    # The encoder expects one file per frame number.
    scene.frame_step = 1
    if samples > 0:
        scene.cycles.samples = samples


def main():
    args = parse_args()
    if args.list_devices:
        list_devices()
        return
    if not args.out:
        raise SystemExit("--out is required when rendering")
    os.makedirs(args.out, exist_ok=True)
    scene = bpy.context.scene
    device = configure_device(scene, args.gpu) if scene.render.engine == "CYCLES" else scene.render.engine
    configure_output(scene, args.out, args.samples)
    print(f"render_worker: gpu={args.gpu} device={device} frames={scene.frame_start}-{scene.frame_end} out={args.out}")


main()
