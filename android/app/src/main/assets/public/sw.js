/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "31988aa4e12d7d9fc45ad19ad2ef33f0"
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/smartphone-DenQcxbH.js",
    "revision": null
  }, {
    "url": "assets/plus-2Jcov_Y1.js",
    "revision": null
  }, {
    "url": "assets/phone-DKRMXLew.js",
    "revision": null
  }, {
    "url": "assets/notificationService-CHXFgNPR.js",
    "revision": null
  }, {
    "url": "assets/navigation-BTdwRvDY.js",
    "revision": null
  }, {
    "url": "assets/message-square-5H3N4yMh.js",
    "revision": null
  }, {
    "url": "assets/marker-shadow-DgTz_Ico.js",
    "revision": null
  }, {
    "url": "assets/index-DIF2EbGs.css",
    "revision": null
  }, {
    "url": "assets/index-Ba5W9mnG.js",
    "revision": null
  }, {
    "url": "assets/hooks-XjpZ15i7.js",
    "revision": null
  }, {
    "url": "assets/file-text-9dOlyysy.js",
    "revision": null
  }, {
    "url": "assets/credit-card-z6w62K60.js",
    "revision": null
  }, {
    "url": "assets/chevron-right-4Cc2Vdi5.js",
    "revision": null
  }, {
    "url": "assets/camera-Bbxza_kX.js",
    "revision": null
  }, {
    "url": "assets/arrow-right-BB2qW3LS.js",
    "revision": null
  }, {
    "url": "assets/arrow-left-7cF1bODl.js",
    "revision": null
  }, {
    "url": "assets/TileLayer-Cchb7zgL.js",
    "revision": null
  }, {
    "url": "assets/Settings-Cv1IzNpO.js",
    "revision": null
  }, {
    "url": "assets/Polyline-DjS201ME.js",
    "revision": null
  }, {
    "url": "assets/PaymentModal-BfTLNzDe.js",
    "revision": null
  }, {
    "url": "assets/LandingView-Bb8N00hE.js",
    "revision": null
  }, {
    "url": "assets/DriverDashboard-3OJxKA4a.js",
    "revision": null
  }, {
    "url": "assets/DeliveryTracking-b0Kq2Zwm.js",
    "revision": null
  }, {
    "url": "assets/DeliveryHistory-DBH4A6e3.js",
    "revision": null
  }, {
    "url": "assets/CreateDelivery-CtGi4UNg.js",
    "revision": null
  }, {
    "url": "assets/ClientDashboard-gOJIVETm.js",
    "revision": null
  }, {
    "url": "assets/Chat-DW4J5glg.js",
    "revision": null
  }, {
    "url": "assets/AdminDashboard-CIGW-MKW.css",
    "revision": null
  }, {
    "url": "assets/AdminDashboard-BYCBekIt.js",
    "revision": null
  }, {
    "url": "android.png",
    "revision": "420ac34194be4ebe31727fe473559bb3"
  }, {
    "url": "apple.png",
    "revision": "a2b5375d81a74f9f92efdc81559229cc"
  }, {
    "url": "favicon.png",
    "revision": "6d32c03caa32908790492f01513a808b"
  }, {
    "url": "logo.png",
    "revision": "f44ddb3f65eec962727bc913bb8eddf2"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
