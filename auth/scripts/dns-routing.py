"""Inspect service DNS, or update only the proxy flag of registered static hosts."""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

ZONE = 'b7e996de9a2e02f1fa00d4cf941d892b'
HOSTS = ['archerlab.dev', 'game.archerlab.dev', 'nevergrad.archerlab.dev', 'karma.archerlab.dev',
         'harem.archerlab.dev', 'cupid.archerlab.dev', 'chatbot.archerlab.dev', 'golf.archerlab.dev',
         'itstory.archerlab.dev', 'news.archerlab.dev', 'chat.archerlab.dev']
PAGES = dict(zip(['game', 'nevergrad', 'karma', 'harem', 'cupid', 'chatbot', 'golf'],
                ['archerlab-games', 'nevergrad', 'karma-f40', 'harem-csy', 'cupid-cc8', 'chatbot-9ss', 'golf-3xe']))
PAGES = {name + '.archerlab.dev': target + '.pages.dev' for name, target in PAGES.items()}
STATIC = {**PAGES, 'itstory.archerlab.dev': 'janghyungyu.github.io',
          'chat.archerlab.dev': 'janghyungyu.github.io'}

def api(path, body=None):
    request = urllib.request.Request('https://api.cloudflare.com/client/v4/' + path,
        headers={'Authorization': 'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN'], 'Content-Type': 'application/json'},
        data=json.dumps(body).encode('utf-8') if body is not None else None,
        method='PATCH' if body is not None else 'GET')
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit('DNS access failed with HTTP ' + str(error.code)) from None
    if not payload.get('success'):
        raise SystemExit('Cloudflare rejected the DNS inspection')
    return payload['result']

def native_session_ready(host):
    path = '/jewelria/' if host == 'game.archerlab.dev' else '/'
    request = urllib.request.Request('https://' + host + path,
        headers={'User-Agent': 'ArcherLab deployment verification'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status == 200 and b'assets/js/archerlab-session.js' in response.read()
    except (urllib.error.URLError, TimeoutError):
        return False

def main():
    mode = os.environ.get('DNS_MODE', 'inspect')
    target = os.environ.get('DNS_TARGET', 'all-pages')
    if mode not in ['inspect', 'pages-direct', 'pages-proxied', 'static-direct', 'static-proxied'] or target not in ['all-pages', 'all-static', *STATIC]:
        raise SystemExit('Unregistered DNS operation')
    allowed = PAGES if mode.startswith('pages-') else STATIC
    records = []
    for host in HOSTS:
        matches = api('zones/' + ZONE + '/dns_records?' + urllib.parse.urlencode({'name': host}))
        for record in matches:
            if record['type'] not in ['A', 'AAAA', 'CNAME']:
                continue
            selected = host == target or target == 'all-static' or (target == 'all-pages' and host in PAGES)
            if mode != 'inspect' and host in allowed and selected:
                if len(matches) != 1 or record['type'] != 'CNAME' or record['content'] != allowed[host]:
                    raise SystemExit('Unexpected DNS target for ' + host)
                previous = record['proxied']
                desired = mode.endswith('-proxied')
                if previous and not desired and not native_session_ready(host):
                    print(json.dumps({'skipped': host, 'reason': 'native_session_script_not_verified'}))
                    records.append({key: record.get(key) for key in ['id', 'name', 'type', 'content', 'proxied', 'ttl']})
                    continue
                if previous != desired:
                    record = api('zones/' + ZONE + '/dns_records/' + record['id'], {'proxied': desired})
                    if record['proxied'] != desired or record['content'] != allowed[host]:
                        raise SystemExit('DNS verification failed for ' + host)
                    print(json.dumps({'updated': host, 'previousProxied': previous, 'proxied': desired}))
            records.append({key: record.get(key) for key in ['id', 'name', 'type', 'content', 'proxied', 'ttl']})
    with open('service-dns.json', 'w', encoding='utf-8') as report:
        json.dump(records, report, indent=2)
    for record in records:
        print(json.dumps({key: value for key, value in record.items() if key != 'id'}))

if __name__ == '__main__':
    main()
