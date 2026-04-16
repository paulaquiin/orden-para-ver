import os
import re

html_files = [
    "contenidos/index.html",
    "descubrir/index.html",
    "descubrir/resultado/index.html",
    "explorar/index.html",
    "franchise/index.html",
    "index.html",
    "novedades/index.html",
    "privacidad/index.html",
    "terminos/index.html",
]

favicon_tag = '    <link rel="icon" type="image/png" href="/favicon.png?v=4" />\n'

for file_path in html_files:
    if not os.path.exists(file_path):
        continue
    
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Replace existing favicon link regardless of extension
    new_content = re.sub(r'<link rel="icon".*?>', favicon_tag.strip(), content)
    
    # If not found (shouldn't happen now but just in case), insert after charset
    if new_content == content and 'rel="icon"' not in content:
        new_content = re.sub(r'(<meta charset=.*?>\n?)', r'\1' + favicon_tag, content, flags=re.IGNORECASE)
    
    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated: {file_path}")
    else:
        print(f"No changes needed or could not apply: {file_path}")
