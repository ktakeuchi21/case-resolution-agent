# Public database trust anchor

`supabase-ca.crt` is the public Supabase Root 2021 CA certificate linked by the dedicated project's Database Settings page. It is not a private key or application credential.

Source: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

SHA-256 certificate fingerprint: `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`.

Observed validity: April 28, 2021 through April 26, 2031. The hosted database configuration requires this CA with certificate and hostname verification; it rejects URL options that could override TLS settings. A certificate rotation requires an explicit reviewed update. Never put private keys or passwords in this directory.
