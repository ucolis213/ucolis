# Génère src/geo/wilayas.json depuis le jeu de données Kossa/algerian-cities (voir docs/DECISIONS.md).
# Usage : python -I build_geo.py <dossier contenant communes.json et wilayas.json> <fichier de sortie>
import json, sys, math, unicodedata
sys.stdout.reconfigure(encoding='utf-8')
src, out = sys.argv[1], sys.argv[2]
c = json.load(open(src + '/communes.json', encoding='utf-8'))
w = json.load(open(src + '/wilayas.json', encoding='utf-8'))
FR = ["Adrar","Chlef","Laghouat","Oum El Bouaghi","Batna","Béjaïa","Biskra","Béchar","Blida","Bouira",
"Tamanrasset","Tébessa","Tlemcen","Tiaret","Tizi Ouzou","Alger","Djelfa","Jijel","Sétif","Saïda",
"Skikda","Sidi Bel Abbès","Annaba","Guelma","Constantine","Médéa","Mostaganem","M'Sila","Mascara","Ouargla",
"Oran","El Bayadh","Illizi","Bordj Bou Arréridj","Boumerdès","El Tarf","Tindouf","Tissemsilt","El Oued","Khenchela",
"Souk Ahras","Tipaza","Mila","Aïn Defla","Naâma","Aïn Témouchent","Ghardaïa","Relizane","Timimoun","Bordj Badji Mokhtar",
"Ouled Djellal","Béni Abbès","In Salah","In Guezzam","Touggourt","Djanet","El M'Ghair","El Meniaa"]
AR = {x['code']: x['ar_name'].strip() for x in w}
def norm(s):
    s = unicodedata.normalize('NFD', s); s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn')
    return ''.join(ch for ch in s.lower() if ch.isalnum())
def hav(a, b):
    R = 6371; p1, p2 = math.radians(a[0]), math.radians(b[0]); dp = p2 - p1; dl = math.radians(b[1] - a[1])
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(h))
bywil = {i: [] for i in range(1, 59)}
seen = set()
for x in c:
    wid = int(x['wilaya_id']); prefix = int(x['post_code'][:-3])
    code = wid if 49 <= wid <= 58 else prefix
    key = (code, norm(x['name']))
    if key in seen: continue
    seen.add(key)
    bywil[code].append({'code': x['post_code'].zfill(5), 'fr': x['name'].strip(), 'ar': x['ar_name'].strip(),
                        'center': {'lat': round(float(x['latitude']), 5), 'lng': round(float(x['longitude']), 5)}})
res = []
for i in range(1, 59):
    cs = sorted(bywil[i], key=lambda k: k['code'])
    fr = FR[i-1]
    chef = next((k for k in cs if k['code'] == f'{i:02d}001'), None) if i <= 48 else None
    if chef is None: chef = next((k for k in cs if norm(fr) in norm(k['fr']) or norm(k['fr']) in norm(fr)), None)
    if chef is None: chef = cs[0]
    center = chef['center']
    far = [(k['fr'], round(hav((center['lat'], center['lng']), (k['center']['lat'], k['center']['lng'])))) for k in cs]
    far = [f for f in far if f[1] > (900 if i in (1,11,33,37,49,50,52,53,54,56,58,8,30) else 350)]
    if far:
        print('FIXED', i, fr, far)
        for k in cs:
            if k['fr'] in [f[0] for f in far]: k['center'] = dict(center)
    res.append({'code': f'{i:02d}', 'fr': fr, 'ar': AR[i], 'center': center, 'communes': cs})
    print(i, fr, AR[i], chef['fr'], center, len(cs))
json.dump({'version': '2026.10-58w', 'wilayas': res}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('total communes', sum(len(r['communes']) for r in res))
