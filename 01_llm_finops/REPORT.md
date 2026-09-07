# REPORT.md — La Confrontation des Modèles (Analyse de la dette sémantique)
 
## 1. Le prompt flou que j'ai utilisé
 
```
Écris un script pour scraper une page web et sauvegarder les données, en gérant les erreurs.
```
 
Volontairement vague : pas de site cible, pas de format de sortie précisé, pas de structure de données, rien sur la sécurité. L'idée c'est de voir ce que chaque IA invente pour combler les trous.
 
## 2. Les deux IA testées
 
- **Claude Sonnet 5** — sur claude.ai, chat direct, sans aucun fichier de contexte. (À noter pour la reproductibilité : l'identifiant exact de version peut changer avec le temps, donc à re-vérifier si quelqu'un veut refaire le test plus tard.)
- **GitHub Copilot Chat** — sur github.com/copilot, mode "Ask", sans repo sélectionné.
Petit point important : Copilot était réglé sur le modèle **"Auto"**, donc ce n'est pas un modèle fixe — GitHub choisit lui-même lequel répond selon la requête, sans forcément le dire. Ça veut dire que je ne peux pas garantir que c'est "le" modèle spécialisé code au sens strict, juste un modèle parmi plusieurs sélectionné automatiquement. Ça ne change rien au fond du constat (les deux IA inventent des trucs pour combler le flou), mais c'est une limite à signaler.
 
## 3. Ce que j'ai observé comme différences
 
Les deux ont sorti un script Python avec `requests` + `BeautifulSoup`, mais pas du tout la même approche derrière :
 
- **Claude** est resté simple : un script court, des sélecteurs CSS inventés au hasard (`.item`, `.title`, `.price`), sauvegarde en CSV, gestion d'erreurs basique.
- **Copilot** est parti beaucoup plus loin : un vrai outil en ligne de commande avec `argparse`, un système pour définir soi-même les champs à extraire, export JSON ou CSV, retries automatiques avec backoff si la requête échoue, et des logs propres avec le module `logging`. Il a aussi ajouté `lxml` comme dépendance en plus.
Aucun des deux ne m'a demandé de préciser le site ou les données à récupérer — chacun a juste tranché à sa manière, et le résultat n'a presque rien à voir d'un modèle à l'autre alors que le prompt de départ était identique.
 
## 4. Les problèmes que j'ai relevés
 
1. **Claude invente des sélecteurs pour un site qui n'existe pas.** `.item`, `.title`, `.price` sortent de nulle part — le code tourne mais il faut tout réécrire pour l'utiliser sur un vrai site.
2. **Copilot part dans une architecture que je n'ai jamais demandée.** Retries avec backoff, mini-langage pour configurer les champs... c'est bien pensé mais complètement disproportionné pour une simple demande de scraping basique. Plus de code = plus de trucs à maintenir pour rien.
3. **Aucun des deux ne vérifie `robots.txt` ou les conditions d'utilisation du site.** Zéro réflexion éthique/légale sur le scraping, alors que c'est justement le genre de chose qu'un humain doit trancher.
4. **Le CSV de Copilot n'échappe pas les valeurs récupérées.** Si une donnée scrapée commence par `=`, `+` ou `-`, ça peut déclencher une injection de formule si le fichier est ouvert dans Excel. Un vrai risque de sécurité passé sous silence.
## 5. Auto-évaluation
 
Ce qui ressort clairement de ce test, c'est qu'aucune des deux IA n'a cherché à clarifier ma demande avant de répondre — les deux ont juste rempli les trous avec ce qui leur semblait le plus probable, mais dans deux directions complètement différentes. Claude a halluciné des détails concrets (des sélecteurs CSS pour un site imaginaire), tandis que Copilot a halluciné toute une architecture non demandée (retries, backoff, mini-DSL de configuration) — une sur-ingénierie qui semble sérieuse mais qui répond à un besoin que je n'ai jamais exprimé.
 
Et sur la sécurité, les deux se rejoignent dans le même angle mort : pas de vérification de `robots.txt`, et pour Copilot, un vrai risque d'injection CSV parce que les données ne sont pas échappées avant d'être écrites. Ça montre bien pourquoi un prompt flou est dangereux en prod : des décisions qui devraient être prises consciemment par un développeur (format de sortie, gestion des erreurs, respect du serveur ciblé, validation des données) finissent choisies au hasard par le modèle, sans que personne ne s'en rende compte avant que ça pose problème.
 
## Annexe — Codes générés
 
<details>
<summary>Réponse de Claude</summary>

```python
import requests
from bs4 import BeautifulSoup
import csv
import time
 
def scrape_page(url):
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Erreur lors de la requête : {e}")
        return None
 
    soup = BeautifulSoup(response.text, "html.parser")
 
    data = []
    for item in soup.select(".item"):
        title = item.select_one(".title")
        price = item.select_one(".price")
        data.append({
            "title": title.get_text(strip=True) if title else None,
            "price": price.get_text(strip=True) if price else None,
        })
 
    return data
 
def save_to_csv(data, filename="output.csv"):
    if not data:
        print("Aucune donnée à sauvegarder.")
        return
    try:
        with open(filename, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
        print(f"Données sauvegardées dans {filename}")
    except IOError as e:
        print(f"Erreur d'écriture du fichier : {e}")
 
if __name__ == "__main__":
    url = "https://example.com"
    result = scrape_page(url)
    save_to_csv(result)
```

</details>

<details>
<summary>Réponse de GitHub Copilot Chat</summary>

```python
#!/usr/bin/env python3
"""
scraper.py
Usage examples:
  python scraper.py --url "https://example.com/products" \
    --item-selector ".product" \
    --fields "title:.title,price:.price,link:a@href" \
    --output products.json --format json
  python scraper.py --url "https://example.com/blog" \
    --item-selector "article.post" \
    --fields "title:h1,summary:.excerpt,author:.meta .author" \
    --output posts.csv --format csv
Field syntax:
  --fields "name:css_selector[@attr],other:css[@attr],plain:."
  - If css_selector is ".", it means the current item element.
  - If @attr is present, the attribute value is extracted (e.g. a@href).
  - If @attr is omitted the text content is used.
Requirements:
  pip install requests beautifulsoup4 lxml
"""
import argparse
import csv
import json
import logging
import sys
import time
from typing import List, Tuple, Dict, Any
import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
# --- Configuration / defaults ---
DEFAULT_TIMEOUT = 10  # seconds
DEFAULT_RETRIES = 3
DEFAULT_BACKOFF_FACTOR = 0.5
DEFAULT_DELAY = 0.5  # delay between retries/requests to be polite
# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("scraper")
# --- Helpers ---
def build_session(retries: int, backoff_factor: float, timeout: int, user_agent: str) -> requests.Session:
    s = requests.Session()
    retries_obj = Retry(
        total=retries,
        backoff_factor=backoff_factor,
        status_forcelist=(500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "POST"]),
    )
    adapter = HTTPAdapter(max_retries=retries_obj)
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    s.headers.update({"User-Agent": user_agent})
    s.request_timeout = timeout  # custom attribute, used by fetch
    return s
def fetch_page(session: requests.Session, url: str, timeout: int) -> requests.Response:
    try:
        resp = session.get(url, timeout=timeout)
        resp.raise_for_status()
        return resp
    except requests.exceptions.RequestException as e:
        logger.error("HTTP error while fetching %s: %s", url, e)
        raise
def parse_fields_spec(spec: str) -> List[Tuple[str, str, str]]:
    """
    Parse a fields spec string like "title:.title,link:a@href,summary:."
    Returns list of tuples (field_name, css_selector, attr_or_none)
    """
    fields = []
    if not spec:
        return fields
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if ":" in part:
            name, expr = part.split(":", 1)
            name = name.strip()
            expr = expr.strip()
        else:
            # legacy: if no name provided use the selector as name
            name = part
            expr = "."
        attr = None
        if "@" in expr:
            css, attr = expr.split("@", 1)
            css = css.strip() or "."
            attr = attr.strip()
        else:
            css = expr.strip() or "."
        fields.append((name, css, attr))
    return fields
def extract_from_item(item, fields_spec: List[Tuple[str, str, str]]) -> Dict[str, Any]:
    data = {}
    for name, css, attr in fields_spec:
        try:
            if css == ".":
                target = item
            else:
                target = item.select_one(css)
            if target is None:
                value = None
            else:
                if attr:
                    value = target.get(attr)
                else:
                    # use text content
                    value = target.get_text(strip=True)
            data[name] = value
        except Exception as e:
            logger.debug("Parsing error for field %s: %s", name, e)
            data[name] = None
    return data
def parse_html(html: str, item_selector: str, fields_spec: List[Tuple[str, str, str]]) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    items = soup.select(item_selector) if item_selector else [soup]
    results = []
    for idx, item in enumerate(items):
        try:
            row = extract_from_item(item, fields_spec)
            results.append(row)
        except Exception as e:
            logger.warning("Failed to parse item %d: %s", idx, e)
    return results
def save_json(path: str, data: List[Dict[str, Any]]):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info("Saved %d records to %s (JSON)", len(data), path)
    except Exception as e:
        logger.error("Failed to write JSON to %s: %s", path, e)
        raise
def save_csv(path: str, data: List[Dict[str, Any]], fieldnames: List[str]):
    try:
        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in data:
                writer.writerow({k: (v if v is not None else "") for k, v in row.items()})
        logger.info("Saved %d records to %s (CSV)", len(data), path)
    except Exception as e:
        logger.error("Failed to write CSV to %s: %s", path, e)
        raise
def detect_json_response(resp: requests.Response) -> bool:
    ctype = resp.headers.get("Content-Type", "")
    return "application/json" in ctype or resp.text.strip().startswith("{") or resp.text.strip().startswith("[")
# --- Main ---
def main():
    parser = argparse.ArgumentParser(description="Simple scraper with error handling and configurable fields")
    parser.add_argument("--url", required=True, help="Target URL to scrape")
    parser.add_argument("--item-selector", default="", help="CSS selector that selects each item (e.g. '.product'). If empty, fields are extracted from whole page.")
    parser.add_argument("--fields", required=True,
                        help='Fields mapping, e.g. "title:.title,price:.price,link:a@href" (see script header)')
    parser.add_argument("--output", required=True, help="Output file path (e.g. data.json or data.csv)")
    parser.add_argument("--format", choices=["json", "csv"], default="json", help="Output format")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Request timeout in seconds")
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES, help="Number of retries for requests")
    parser.add_argument("--backoff", type=float, default=DEFAULT_BACKOFF_FACTOR, help="Backoff factor for retries")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY, help="Delay (seconds) before fetching to be polite")
    parser.add_argument("--user-agent", default="scraper/1.0 (+https://example.com)", help="User-Agent header")
    args = parser.parse_args()
    logger.info("Starting scraper for %s", args.url)
    fields_spec = parse_fields_spec(args.fields)
    if not fields_spec:
        logger.error("No fields parsed from --fields, exiting")
        sys.exit(2)
    session = build_session(args.retries, args.backoff, args.timeout, args.user_agent)
    try:
        time.sleep(max(0, args.delay))
        resp = fetch_page(session, args.url, timeout=args.timeout)
    except Exception:
        logger.exception("Aborting due to fetch error.")
        sys.exit(1)
    # If the server returned JSON, try to save raw JSON (helpful for API endpoints)
    if detect_json_response(resp):
        try:
            payload = resp.json()
        except ValueError:
            logger.warning("Response claimed JSON but failed to parse; treating as HTML.")
            payload = None
        if payload is not None:
            try:
                if args.format == "json":
                    save_json(args.output, payload if isinstance(payload, list) else [payload])
                else:
                    records = payload if isinstance(payload, list) else [payload]
                    if not records:
                        logger.warning("JSON payload empty; writing empty CSV")
                        save_csv(args.output, [], [])
                    else:
                        keys = sorted({k for r in records for k in (r.keys() if isinstance(r, dict) else [])})
                        save_csv(args.output, records, keys)
                sys.exit(0)
            except Exception:
                logger.exception("Failed saving JSON response.")
                sys.exit(1)
    # Otherwise parse as HTML
    try:
        html = resp.text
        items = parse_html(html, args.item_selector, fields_spec)
        if not items:
            logger.warning("No items extracted (check your --item-selector and --fields).")
        if args.format == "json":
            save_json(args.output, items)
        else:
            field_names = [name for name, _, _ in fields_spec]
            save_csv(args.output, items, field_names)
    except Exception:
        logger.exception("Unexpected error during parse/save.")
        sys.exit(1)
if __name__ == "__main__":
    main()
```
 
</details>