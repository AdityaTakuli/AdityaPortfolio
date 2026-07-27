# Portfolio — Aditya Pratap Singh Takuli

Black-and-white portfolio site with a graph-paper background, built with Flask (Python).

## Run locally

```bash
cd Portfolio
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000).

## Structure

- `app.py` — Flask app + resume content
- `templates/index.html` — page markup
- `static/css/style.css` — graph-sheet B&W theme
- `static/img/profile.jpg` — profile photo
- `static/Aditya_Pratap_Singh_Takuli_Resume.pdf` — downloadable resume

## Notes

- Social links in `app.py` (`PROFILE["links"]`) may need your exact URLs.
- Animations can be added later without changing the layout.
