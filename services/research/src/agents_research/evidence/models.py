from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Word(StrictModel):
    start: int
    end: int
    rect: list[float]


class Passage(StrictModel):
    id: str
    text: str
    sourceType: Literal["abstract", "full_text"]
    pageNumber: int | None = None
    words: list[Word] = Field(default_factory=list)


class Page(StrictModel):
    number: int
    width: float
    height: float


class Document(StrictModel):
    id: str
    workId: str
    title: str
    sourceUrl: str | None = None
    sourceType: Literal["abstract", "full_text", "none"]
    pages: list[Page] = Field(default_factory=list)
    passages: list[Passage] = Field(default_factory=list)
    pdfStatus: Literal["available", "unavailable", "failed"] = "unavailable"
    message: str = ""


class Column(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=100)
    question: str = Field(default="", max_length=1000)


class AnalyseRequest(StrictModel):
    workId: str = Field(pattern=r"^W[0-9]+$")
    question: str = Field(min_length=1, max_length=4000)
    columns: list[Column] = Field(min_length=1, max_length=24)


class Quote(StrictModel):
    passageId: str
    quote: str


class Candidate(StrictModel):
    columnId: str
    status: Literal["supported", "not_reported"]
    value: str
    evidence: list[Quote]


class Candidates(StrictModel):
    cells: list[Candidate]


class Verdict(StrictModel):
    columnId: str
    supported: bool


class Verdicts(StrictModel):
    verdicts: list[Verdict]


class Evidence(StrictModel):
    id: str
    claimId: str
    documentId: str
    passageId: str
    text: str
    section: str
    sourceType: Literal["abstract", "full_text"]
    page: int | None
    startOffset: int
    endOffset: int
    rects: list[list[float]]


class Cell(StrictModel):
    claimId: str
    value: str
    status: Literal["supported", "not_reported"]
    evidenceIds: list[str]


class Analysis(StrictModel):
    documentId: str
    sourceUrl: str | None = None
    question: str
    sourceType: Literal["abstract", "full_text", "none"]
    cells: dict[str, Cell]
    evidence: list[Evidence]
    model: str
    promptVersion: str = "grounded-extraction-v1"
