"""Build a portable source archive excluding Git/hosting identity and transient output."""
import zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
files=[p for p in root.rglob('*') if p.is_file() and not any(x.startswith('.') or x=='__pycache__' for x in p.relative_to(root).parts) and p.suffix not in ['.aux','.log','.out','.pyc','.zip']]
files.append(root/'.gitignore')
with zipfile.ZipFile(root/'dist/source.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
 for p in sorted(files):
  info=zipfile.ZipInfo(str(p.relative_to(root)),date_time=(2026,11,25,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,p.read_bytes())
print(f'Packaged {len(files)} files')
