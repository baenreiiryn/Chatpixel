"""Verify and exercise the actual web files packaged in the release APK."""
import pathlib
import sys
import zipfile

source = pathlib.Path("out")
target = pathlib.Path("test-results/apk-web")
with zipfile.ZipFile(sys.argv[1]) as apk:
    files = [p for p in source.rglob("*") if p.is_file()]
    assert any(p.suffix == ".css" and "_next" in p.parts for p in files)
    assert any(p.suffix == ".js" and "_next" in p.parts for p in files)
    for file in files:
        relative = file.relative_to(source)
        name = "assets/" + relative.as_posix()
        assert name in apk.namelist(), f"Missing packaged web asset: {name}"
        data = apk.read(name)
        assert data == file.read_bytes(), f"Changed packaged web asset: {name}"
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
print(f"PASS: {len(files)} exported web files match the signed APK, including CSS and JavaScript.")
