# Unmögliche Kollabs

Zufällige Marke × zufälliges Produkt. Ein Textmodell schreibt das Konzept, FLUX fotografiert das Produkt.
Beides läuft kostenlos über Cloudflare Workers AI (10.000 Neurons pro Tag, reicht für grob 60–80 Entwürfe).

## Einrichten

1. Cloudflare-Konto anlegen (kostenlos) → Dashboard → **AI → Workers AI** → **REST API verwenden**.
   - **Account-ID** kopieren
   - **API-Token erstellen** (Vorlage „Workers AI“)
2. Dieses Projekt auf Vercel bringen, z. B. per GitHub-Repo importieren oder im Ordner `npx vercel` ausführen.
3. In Vercel → Projekt → **Settings → Environment Variables**:
   - `CLOUDFLARE_ACCOUNT_ID` = deine Account-ID
   - `CLOUDFLARE_API_TOKEN` = dein Token
4. Einmal neu deployen.

Optional: `CF_TEXT_MODEL` und `CF_IMAGE_MODEL` überschreiben die Standardmodelle.

## Dateien

- `index.html` – die komplette Oberfläche
- `api/concept.js` – schreibt Name, Slogan, Features und den Bild-Prompt
- `api/image.js` – erzeugt das Foto mit FLUX
- Das Archiv speichert der Browser lokal (IndexedDB).
