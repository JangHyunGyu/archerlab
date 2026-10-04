"""Inspect only the hub's service DNS records using the repository's CI credential."""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

ZONE = 'b7e996de9a2e02f1fa00d4cf941d892b'
HOSTS = ['archerlab.dev', 'game.archerlab.dev', 'nevergrad.archerlab.dev', 'karma.archerlab.dev',
         'harem.archerlab.dev', 'cupid.archerlab.dev', 'chatbot.archerlab.dev', 'golf.archerlab.dev',
         'itstory.archerlab.dev', 'news.archerlab.dev', 'chat.archerlab.dev']

def api(path):
    request = urllib.request.Request('https://api.cloudflare.com/client/v4/' + path,
        headers={'Authorization': 'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN']})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit('DNS access failed with HTTP ' + str(error.code)) from None
    if not payload.get('success'):
        raise SystemExit('Cloudflare rejected the DNS inspection')
    return payload['result']

def main():
    records = []
    for host in HOSTS:
        matches = api('zones/' + ZONE + '/dns_records?' + urllib.parse.urlencode({'name': host}))
        records.extend({key: record.get(key) for key in ['id', 'name', 'type', 'content', 'proxied', 'ttl']}
                       for record in matches if record['type'] in ['A', 'AAAA', 'CNAME'])
    with open('service-dns.json', 'w', encoding='utf-8') as report:
        json.dump(records, report, indent=2)
    for record in records:
        print(json.dumps({key: value for key, value in record.items() if key != 'id'}))

if __name__ == '__main__':
    main()
