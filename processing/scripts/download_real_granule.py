import os
import earthaccess

def main():
    auth = earthaccess.login(strategy="netrc")
    print("Earthaccess auth status:", auth.authenticated)

    target_dir = os.path.abspath("processing/data/raw")
    os.makedirs(target_dir, exist_ok=True)

    expected_file = os.path.join(target_dir, "3B-HHR-E.MS.MRG.3IMERG.20240101-S000000-E002959.0000.V07B.HDF5")
    if os.path.exists(expected_file):
        os.remove(expected_file)

    print("Searching for IMERG Early Granule in CMR...")
    results = earthaccess.search_data(
        short_name="GPM_3IMERGHHE",
        version="07",
        granule_name="*20240101-S000000*"
    )
    print("CMR Results:", len(results))
    for r in results:
        print("Granule:", r["meta"]["native-id"])

    print("Downloading granule with earthaccess...")
    downloaded = earthaccess.download(results[:1], local_path=target_dir)
    print("Downloaded:", downloaded)

    if os.path.exists(expected_file):
        size = os.path.getsize(expected_file)
        print(f"SUCCESS! File downloaded: {expected_file} ({size:,} bytes)")
    else:
        print("Target file not found!")

if __name__ == "__main__":
    main()
