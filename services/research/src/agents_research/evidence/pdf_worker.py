"""Untrusted PDFs run in a short-lived, resource-bounded subprocess, never the API worker."""

import json
import sys
from pathlib import Path

import pdfplumber


def parse(path: str, document_id: str) -> dict[str, object]:
    pages: list[dict[str, object]] = []
    passages: list[dict[str, object]] = []
    total = 0
    with pdfplumber.open(path) as pdf:
        if len(pdf.pages) > 60:
            raise ValueError("Document exceeds the 60-page processing limit")
        for number, page in enumerate(pdf.pages, 1):
            pages.append({"number": number, "width": page.width, "height": page.height})
            words = page.extract_words(use_text_flow=True, x_tolerance=1)
            for offset in range(0, len(words), 100):
                text = ""
                spans: list[dict[str, object]] = []
                for word in words[offset : offset + 100]:
                    start = len(text)
                    text += str(word["text"])
                    spans.append(
                        {
                            "start": start,
                            "end": len(text),
                            "rect": [
                                100 * float(word["x0"]) / page.width,
                                100 * float(word["top"]) / page.height,
                                100 * (float(word["x1"]) - float(word["x0"])) / page.width,
                                100 * (float(word["bottom"]) - float(word["top"])) / page.height,
                            ],
                        }
                    )
                    text += " "
                text = text.rstrip()
                total += len(text)
                if total > 100000:
                    raise ValueError("Document exceeds the 100,000-character analysis limit")
                if text:
                    passages.append(
                        {
                            "id": f"{document_id}:p{number}:{offset}",
                            "text": text,
                            "sourceType": "full_text",
                            "pageNumber": number,
                            "words": spans,
                        }
                    )
    return {"pages": pages, "passages": passages}


def main() -> None:
    import resource

    resource.setrlimit(resource.RLIMIT_CPU, (35, 35))
    resource.setrlimit(resource.RLIMIT_FSIZE, (20 * 1024 * 1024, 20 * 1024 * 1024))
    if sys.platform == "linux":
        resource.setrlimit(resource.RLIMIT_AS, (1536 * 1024 * 1024, 1536 * 1024 * 1024))
    mode, source, target, value = sys.argv[1:]
    if mode == "parse":
        Path(target).write_text(json.dumps(parse(source, value)))
    elif mode == "render":
        with pdfplumber.open(source) as pdf:
            page = pdf.pages[int(value) - 1]
            if page.width <= 0 or page.height <= 0 or page.width * page.height > 2000000:
                raise ValueError("Unsupported page dimensions")
            page.to_image(resolution=110).save(target, format="PNG")
    else:
        raise ValueError("Unknown operation")


if __name__ == "__main__":
    main()
