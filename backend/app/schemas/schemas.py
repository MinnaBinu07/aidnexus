from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    phone: Optional[str] = None
    role: str = Field(default="member", pattern="^(admin|member|investigator)$")

class UserRegister(UserBase):
    password: str = Field(..., min_length=6, max_length=128)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(UserBase):
    id: int
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class TokenPayload(BaseModel):
    sub: str
    role: str
    is_verified: bool
    exp: Optional[int] = None

# Community Schemas
class CommunityCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10)

class CommunityUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, min_length=10)
    status: Optional[str] = Field(None, pattern="^(open|closed)$")

class RequiredFieldSchema(BaseModel):
    id: Optional[int] = None
    label: str = Field(..., min_length=2, max_length=255)
    field_type: str = Field(
        ...,
        pattern="^(name|phone|address|id_number|bank_account|upi_id|photo|document|text)$"
    )
    is_required: bool = True
    order: int = 0

    model_config = ConfigDict(from_attributes=True)

class RequiredFieldsUpdate(BaseModel):
    fields: List[RequiredFieldSchema]

class CommunityOut(BaseModel):
    id: int
    admin_id: int
    title: str
    description: str
    qr_image_path: Optional[str] = None
    is_verified_admin: bool
    status: str
    created_at: datetime
    required_fields: List[RequiredFieldSchema] = []

    model_config = ConfigDict(from_attributes=True)

class AccessCodeItem(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = None

class BulkCodesCreate(BaseModel):
    codes: List[AccessCodeItem] = Field(..., min_length=1)

class AccessCodeOut(BaseModel):
    id: int
    community_id: int
    code: str
    issued_to_label: str
    issued_to_phone: Optional[str] = None
    status: str
    expires_at: Optional[datetime] = None
    redeemed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class JoinValidateRequest(BaseModel):
    code: str

class JoinFormResponse(BaseModel):
    code: str
    community_id: int
    community_title: str
    community_description: str
    admin_name: str
    is_verified_admin: bool
    consent_notice: str
    required_fields: List[RequiredFieldSchema]

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int

class ReviewAction(BaseModel):
    action: str = Field(..., pattern="^(confirmed|false_alarm|needs_field_visit)$")
    status_change: Optional[str] = Field(None, pattern="^(pending|approved|info_requested|rejected_by_admin)$")

class DocumentRequestCreate(BaseModel):
    submission_id: int
    message: str = Field(..., min_length=3)
    requested_labels: List[str] = Field(default_factory=list)

class DocumentRequestOut(BaseModel):
    id: int
    community_id: int
    submission_id: int
    message: str
    requested_labels: List[str]
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CommunityStatsOut(BaseModel):
    total_submissions: int
    pending_submissions: int
    approved_submissions: int
    flagged_submissions: int
    total_codes: int
    redeemed_codes: int
    unused_codes: int
    flagged_networks_count: int
    total_links_count: int

class InvestigationLogOut(BaseModel):
    id: int
    investigator_id: int
    query_type: str
    query_hash: str
    result_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class MatchingSubmissionOut(BaseModel):
    submission_id: int
    community_id: int
    community_title: str
    applicant_name: str
    status: str
    risk_score: float
    hamming_distance: Optional[int] = None
    matched_field: Optional[str] = None
    matched_value_masked: Optional[str] = None
    similarity_score: Optional[float] = None
    explanation: str
    created_at: datetime

class PublicCommunityOut(BaseModel):
    id: int
    title: str
    description: str
    admin_name: str
    is_verified_admin: bool
    status: str
    qr_image_path: Optional[str] = None
    approved_members_count: int
    created_at: datetime

