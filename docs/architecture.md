# Architecture

## Flow

```text
React frontend
  -> Express API
    -> MongoDB attendance database
    -> Face recognition adapter
    -> Fingerprint scanner adapter
```

## Face recognition adapter

The backend already accepts numerical face descriptors and compares them with stored descriptors.

Later options:

- Browser-side descriptor generation using a face recognition model.
- Python service using OpenCV or DeepFace.

## Fingerprint adapter

Do not hard-code scanner logic until hardware is selected.

Supported future path:

```text
scanner SDK -> local device service -> backend /api/attendance/fingerprint
```

Recommended scanners to evaluate:

- Mantra MFS100
- SecuGen Hamster Pro
- ZKTeco
- R307 module for prototype projects
