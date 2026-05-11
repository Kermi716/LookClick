const AD_DOMAINS = [
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'google-analytics.com',
    'googletagmanager.com',
    'google-analytics.com',
    'adnxs.com',
    'adsrvr.org',
    'adtech.de',
    'advertising.com',
    'adriver.ru',
    'begun.ru',
    'between.digital',
    'betweendigital.com',
    'bidswitch.net',
    'boombeam.com',
    'casalemedia.com',
    'criteo.com',
    'criteo.net',
    'crwdcntrl.net',
    'demdex.net',
    'exelator.com',
    'improve.digital',
    'indexww.com',
    'lijit.com',
    'lkqd.net',
    'lucidmedia.com',
    'mathtag.com',
    'media.net',
    'moatads.com',
    'openx.net',
    'pubmatic.com',
    'quantserve.com',
    'rubiconproject.com',
    'scorecardresearch.com',
    'serving-sys.com',
    'sharethrough.com',
    'smartadserver.com',
    'socdm.com',
    'spotxchange.com',
    'taboola.com',
    'tns-counter.ru',
    'tradedoubler.com',
    'trueview.com',
    'turn.com',
    'videohub.tv',
    'yandex-team.ru',
    'yandex.ru',
    'yadro.ru',
    'mc.yandex.ru',
    'an.yandex.ru',
    'adblade.com',
    'adcash.com',
    'adclick.g.doubleverify.com',
    'adhese.com',
    'adkernel.com',
    'adloox.com',
    'admixer.net',
    'adnium.com',
    'adspirit.de',
    'adsystem.com',
    'adzerk.net',
    'affiliates.one',
    'appnexus.com',
    'banner.guru',
    'bidz.com',
    'brealtime.com',
    'clickadu.com',
    'clickbooth.com',
    'cmpstar.com',
    'conversantmedia.com',
    'ezakus.net',
    'fam-ad.com',
    'freewheel.tv',
    'geoads.com',
    'hbopout.com',
    'hightrafficads.com',
    'innovid.com',
    'intellitxt.com',
    'justpremium.com',
    'kiosked.com',
    'linksynergy.com',
    'liverail.com',
    'liveintent.com',
    'loopme.com',
    'marinsm.com',
    'mfadsrvr.com',
    'mopub.com',
    'nexage.com',
    'nuseek.com',
    'oascentral.com',
    'optimatic.com',
    'outbrain.com',
    'owneriq.net',
    'permodo.com',
    'plista.com',
    'po.st',
    'popads.net',
    'popcash.net',
    'popunder.ru',
    'postrelease.com',
    'pro-market.net',
    'propellerads.com',
    'revcontent.com',
    'revjet.com',
    'rhythmone.com',
    'richaudience.com',
    'ro-ads.com',
    'ronstr.com',
    'rx-adserver.com',
    's1.adform.net',
    'semasio.net',
    'servebom.com',
    'servebid.com',
    'servedby.flashtalking.com',
    'smaato.net',
    'sonobi.com',
    'springserve.com',
    'spotx.tv',
    'synacor.com',
    'tapad.com',
    'teads.tv',
    'traffiq.com',
    'tribalfusion.com',
    'tvpixel.com',
    'tynt.com',
    'undertone.com',
    'unrulymedia.com',
    'valueclick.com',
    'veruta.com',
    'videologygroup.com',
    'vindico.com',
    'visual-iq.com',
    'widespace.com',
    'xaxis.com',
    'ybrant.com',
    'yieldmo.com',
    'yieldoptimizer.com',
    'zedo.com',
    'zeotap.com',
    'distribrey.com'
];

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const hostname = url.hostname;

    const isAd = AD_DOMAINS.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
    );

    if (isAd) {
        event.respondWith(new Response('', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        }));
        return;
    }

    if (event.request.mode === 'navigate' && event.request.referrer) {
        const referer = new URL(event.request.referrer);
        if (referer.hostname !== url.hostname && !isAllowedNavigation(url)) {
            event.respondWith(new Response('<html><body></body></html>', {
                headers: { 'Content-Type': 'text/html' }
            }));
            return;
        }
    }

    event.respondWith(fetch(event.request));
});

function isAllowedNavigation(url) {
    const allowed = [
        self.location.hostname,
        'kermi.pythonanywhere.com',
    ];
    return allowed.some(d => url.hostname === d || url.hostname.endsWith('.' + d));
}

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});
