import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Storefront smoke/load test (PRD NFR: storefront p95 < 500ms, admin < 800ms).
 *
 *   k6 run -e BASE_URL=https://atlas.example -e STORE_SLUG=nokshi loadtest/k6-storefront.js
 *
 * Thresholds fail the run, so this is safe to wire into a staging pipeline.
 */

export const options = {
  scenarios: {
    shoppers: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 25 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{page:home}": ["p(95)<500"],
    "http_req_duration{page:shop}": ["p(95)<500"],
    "http_req_duration{page:product}": ["p(95)<500"],
    "http_req_duration{page:health}": ["p(95)<800"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const STORE = __ENV.STORE_SLUG || "nokshi";

export default function storefrontSmokeTest() {
  const home = http.get(`${BASE_URL}/store/${STORE}`, { tags: { page: "home" } });
  check(home, { "home 200": (response) => response.status === 200 });

  const shop = http.get(`${BASE_URL}/store/${STORE}/shop`, { tags: { page: "shop" } });
  check(shop, { "shop 200": (response) => response.status === 200 });

  const product = http.get(`${BASE_URL}/api/v1/public/stores/${STORE}/products?perPage=8`, {
    tags: { page: "product" },
  });
  check(product, { "catalog 200": (response) => response.status === 200 });

  const health = http.get(`${BASE_URL}/api/v1/health`, { tags: { page: "health" } });
  check(health, { "health 200": (response) => response.status === 200 });

  sleep(1);
}
