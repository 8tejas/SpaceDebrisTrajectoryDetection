# Space Debris Frontend (Globe View)

This frontend visualizes orbital debris trajectories with three layers:

- Raw SGP4 trajectory (baseline)
- ML-corrected trajectory
- Observed/ground-truth trajectory

It also shows RMSE/MAE and an error-over-time chart.

## Run With Flask

From the project root, create/activate your Python environment, install dependencies, and start Flask:

```powershell
pip install -r requirements.txt
python app.py
```

Then open:

- http://localhost:5000

Optional health check:

- http://localhost:5000/health

## Hooking to your real pipeline

Replace synthetic data in `app.js`:

1. Replace `debrisCatalog` with objects from your TLE + metadata source.
2. Replace `generateTrajectory()` so it consumes:
   - SGP4 outputs (x, y, z) from backend
   - ML correction outputs (dx, dy, dz)
   - Observed positions for evaluation
3. Keep `evaluateTrajectory()` and rendering functions as-is, or route metrics from backend.

If your backend returns ECI or ECEF Cartesian coordinates, convert to lat/lng/alt before passing to globe paths.
