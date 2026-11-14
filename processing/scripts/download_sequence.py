import os
import earthaccess
import h5py

def main():
    auth = earthaccess.login(strategy="netrc")
    print("Earthaccess auth status:", auth.authenticated)

    target_dir = os.path.abspath("processing/data/raw")
    os.makedirs(target_dir, exist_ok=True)

    print("Searching for the 6 consecutive granules...")
    results = earthaccess.search_data(
        short_name="GPM_3IMERGHHE",
        version="07",
        temporal=("2024-01-01T00:00:00", "2024-01-01T02:59:59")
    )
    print("Total granules found:", len(results))
    to_download = []
    for r in results[:6]:
        granule_id = r["meta"]["native-id"].split(":")[-1]
        file_path = os.path.join(target_dir, granule_id)
        if os.path.exists(file_path) and os.path.getsize(file_path) > 1000000:
            print(f"Already exists: {granule_id} ({os.path.getsize(file_path):,} bytes)")
        else:
            to_download.append(r)

    if to_download:
        print(f"Downloading {len(to_download)} new granules...")
        downloaded = earthaccess.download(to_download, local_path=target_dir)
        print("Downloaded:", len(downloaded))

    print("\n--- Verifying Integrity of All 6 Granules ---")
    for r in results[:6]:
        granule_id = r["meta"]["native-id"].split(":")[-1]
        file_path = os.path.join(target_dir, granule_id)
        size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        try:
            with h5py.File(file_path, "r") as f:
                dset = f["/Grid/precipitation"]
                shape = dset.shape
                valid = True
        except Exception as e:
            valid = False
            shape = str(e)
        print(f"Granule: {granule_id} | Size: {size:,} bytes | HDF5 Valid: {valid} | Shape: {shape}")

if __name__ == "__main__":
    main()
