const { isIP } = require("node:net");
const puppeteer = require("puppeteer");

const BLOCKED_RESOURCE_TYPES = new Set(["image", "stylesheet", "font"]);
const ALLOWED_ENTRY_HOSTS = new Set(["google.com", "www.google.com", "maps.app.goo.gl", "goo.gl"]);
const ALLOWED_REQUEST_HOST_SUFFIXES = [".google.com", ".gstatic.com", ".googleapis.com"];
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1"]);

function isPrivateIpv4(hostname) {
  const octets = hostname.split(".").map((value) => Number.parseInt(value, 10));
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }

  if (octets[0] === 10 || octets[0] === 127) return true;
  if (octets[0] === 169 && octets[1] === 254) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  return false;
}

function isPrivateIpv6(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isBlockedNetworkHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return true;

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    return isPrivateIpv4(host);
  }
  if (ipVersion === 6) {
    return isPrivateIpv6(host);
  }

  return false;
}

function isAllowedRequestHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host || isBlockedNetworkHost(host)) {
    return false;
  }

  return (
    ALLOWED_ENTRY_HOSTS.has(host) ||
    ALLOWED_REQUEST_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

function parseAllowedGoogleMapsUrl(rawUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("지원하지 않는 URL 형식이에요. Google Maps 링크를 다시 확인해 주세요.");
  }

  if (!["https:", "http:"].includes(parsedUrl.protocol)) {
    throw new Error("Google Maps 웹 링크만 가져올 수 있어요.");
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("인증 정보가 포함된 URL은 가져올 수 없어요.");
  }
  if (isBlockedNetworkHost(parsedUrl.hostname)) {
    throw new Error("내부망이나 로컬 주소는 가져올 수 없어요.");
  }

  const normalizedHost = parsedUrl.hostname.toLowerCase();
  if (!ALLOWED_ENTRY_HOSTS.has(normalizedHost) && !normalizedHost.endsWith(".google.com")) {
    throw new Error("Google Maps 링크만 가져올 수 있어요.");
  }

  return parsedUrl.toString();
}

function shouldAllowRequest(requestUrl) {
  try {
    const parsedUrl = new URL(requestUrl);
    if (!["https:", "http:"].includes(parsedUrl.protocol)) {
      return false;
    }
    return isAllowedRequestHost(parsedUrl.hostname);
  } catch {
    return false;
  }
}

async function scrapeList(rawUrl) {
  const url = parseAllowedGoogleMapsUrl(rawUrl);
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (BLOCKED_RESOURCE_TYPES.has(req.resourceType())) {
      req.abort();
      return;
    }

    if (!shouldAllowRequest(req.url())) {
      req.abort();
      return;
    }

    req.continue();
  });

  try {
    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    if (!shouldAllowRequest(page.url())) {
      throw new Error("허용되지 않은 외부 주소로 이동해서 가져오기를 중단했어요.");
    }

    await page.waitForSelector(".fontHeadlineSmall", { timeout: 30000 });

    const scrollableSelector =
      (await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll("div"));
        const scrollable = containers.find((element) => {
          const style = window.getComputedStyle(element);
          return (
            (style.overflowY === "scroll" || style.overflowY === "auto") &&
            element.scrollHeight > element.clientHeight
          );
        });

        if (scrollable) {
          if (scrollable.className) {
            return `.${scrollable.className.trim().split(/\s+/).join(".")}`;
          }
          return "div[role=\"feed\"]";
        }
        return null;
      })) || ".m6QErb";

    console.log(`Identified scrollable container selector: ${scrollableSelector}`);

    await page.evaluate(async (selector) => {
      let container = null;
      try {
        container = document.querySelector(selector);
      } catch {
        console.warn("Invalid selector:", selector);
      }

      if (!container) {
        container = document.querySelector("div[role=\"feed\"]") || document.querySelector(".m6QErb");
      }

      if (!container) {
        console.log("No scrollable container found, skipping scroll.");
        return;
      }

      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 1000;
        const timer = setInterval(() => {
          const scrollHeight = container.scrollHeight;
          container.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight && container.scrollHeight <= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    }, scrollableSelector);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const places = await page.evaluate(() => {
      const items = document.querySelectorAll(".BsJqK");
      const results = [];

      items.forEach((item) => {
        const nameEl = item.querySelector(".fontHeadlineSmall");
        const noteEl = item.querySelector(".u5DVOd");

        if (nameEl) {
          results.push({
            name: nameEl.innerText.trim(),
            note: noteEl ? noteEl.innerText.trim() : null
          });
        }
      });
      return results;
    });

    console.log(`Scraped ${places.length} places.`);
    return places;
  } catch (error) {
    console.error("Scrape error:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeList };
