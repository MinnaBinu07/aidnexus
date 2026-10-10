from datetime import datetime, timezone
import json
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime,
    ForeignKey, UniqueConstraint, BigInteger
)
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50), nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="member")  # admin | member | investigator
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    communities = relationship("Community", back_populates="admin")
    memberships = relationship("Membership", back_populates="user")
    notifications = relationship("Notification", back_populates="user")


class Community(Base):
    __tablename__ = "communities"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    qr_image_path = Column(String(500), nullable=True)
    is_verified_admin = Column(Boolean, default=False, nullable=False)
    status = Column(String(50), default="open", nullable=False)  # open | closed
    created_at = Column(DateTime, default=utc_now, nullable=False)

    admin = relationship("User", back_populates="communities")
    required_fields = relationship("RequiredField", back_populates="community", order_by="RequiredField.order")
    access_codes = relationship("AccessCode", back_populates="community")
    memberships = relationship("Membership", back_populates="community")
    submissions = relationship("Submission", back_populates="community")


class RequiredField(Base):
    __tablename__ = "required_fields"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False)
    label = Column(String(255), nullable=False)
    field_type = Column(String(50), nullable=False)  # name, phone, address, id_number, bank_account, upi_id, photo, document, text
    is_required = Column(Boolean, default=True, nullable=False)
    order = Column(Integer, default=0, nullable=False)

    community = relationship("Community", back_populates="required_fields")


class AccessCode(Base):
    __tablename__ = "access_codes"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False)
    code = Column(String(64), unique=True, index=True, nullable=False)
    issued_to_label = Column(String(255), nullable=False)
    issued_to_phone = Column(String(50), nullable=True)
    status = Column(String(50), default="unused", nullable=False)  # unused | redeemed | revoked | expired
    expires_at = Column(DateTime, nullable=True)
    redeemed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    redeemed_at = Column(DateTime, nullable=True)

    community = relationship("Community", back_populates="access_codes")
    redeemed_by = relationship("User")
    membership = relationship("Membership", back_populates="access_code", uselist=False)


class Membership(Base):
    __tablename__ = "memberships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False)
    access_code_id = Column(Integer, ForeignKey("access_codes.id"), unique=True, nullable=False)
    status = Column(String(50), default="pending", nullable=False)  # pending | approved | info_requested | rejected_by_admin
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="memberships")
    community = relationship("Community", back_populates="memberships")
    access_code = relationship("AccessCode", back_populates="membership")
    submission = relationship("Submission", back_populates="membership", uselist=False)

    __table_args__ = (
        UniqueConstraint("user_id", "community_id", name="uq_user_community_membership"),
    )


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    membership_id = Column(Integer, ForeignKey("memberships.id"), unique=True, nullable=False)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False)
    status = Column(String(50), default="pending", nullable=False)  # pending | approved | info_requested | rejected_by_admin
    risk_score = Column(Float, default=0.0, nullable=False)
    _risk_reasons = Column("risk_reasons", Text, default="[]", nullable=False)
    analysis_status = Column(String(50), default="pending", nullable=False)  # pending | done | failed
    review_status = Column(String(50), nullable=True)  # confirmed | false_alarm | needs_field_visit
    created_at = Column(DateTime, default=utc_now, nullable=False)

    membership = relationship("Membership", back_populates="submission")
    community = relationship("Community", back_populates="submissions")
    values = relationship("SubmissionValue", back_populates="submission", cascade="all, delete-orphan")
    evidence = relationship("Evidence", back_populates="submission", cascade="all, delete-orphan")

    @property
    def risk_reasons(self):
        try:
            return json.loads(self._risk_reasons) if self._risk_reasons else []
        except Exception:
            return []

    @risk_reasons.setter
    def risk_reasons(self, value):
        self._risk_reasons = json.dumps(value if value is not None else [])


class SubmissionValue(Base):
    __tablename__ = "submission_values"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    required_field_id = Column(Integer, ForeignKey("required_fields.id"), nullable=False)
    raw_value = Column(Text, nullable=True)
    normalized_value = Column(String(500), index=True, nullable=True)

    submission = relationship("Submission", back_populates="values")
    required_field = relationship("RequiredField")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    required_field_id = Column(Integer, ForeignKey("required_fields.id"), nullable=False)
    file_path = Column(String(500), nullable=False)
    sha256 = Column(String(64), index=True, nullable=False)
    phash = Column(BigInteger, index=True, nullable=True)
    ocr_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    submission = relationship("Submission", back_populates="evidence")
    required_field = relationship("RequiredField")


class Link(Base):
    __tablename__ = "links"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=True)  # Nullable for cross-community
    submission_a = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    submission_b = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    link_type = Column(String(50), nullable=False)  # phone|address|bank_account|upi_id|id_number|name|similar_image|exact_file
    matched_value_hint = Column(String(255), nullable=True)
    strength = Column(Float, default=1.0, nullable=False)
    explanation = Column(Text, nullable=False)

    __table_args__ = (
        UniqueConstraint("submission_a", "submission_b", "link_type", name="uq_submission_pair_link_type"),
    )


class DocumentRequest(Base):
    __tablename__ = "document_requests"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    message = Column(Text, nullable=False)
    _requested_labels = Column("requested_labels", Text, default="[]", nullable=False)
    status = Column(String(50), default="open", nullable=False)  # open | fulfilled
    created_at = Column(DateTime, default=utc_now, nullable=False)

    @property
    def requested_labels(self):
        try:
            return json.loads(self._requested_labels) if self._requested_labels else []
        except Exception:
            return []

    @requested_labels.setter
    def requested_labels(self, value):
        self._requested_labels = json.dumps(value if value is not None else [])


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)  # view_submission|view_file|download|search|login|code_generated|reveal_value...
    target_type = Column(String(50), nullable=True)
    target_id = Column(Integer, nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class InvestigationLog(Base):
    __tablename__ = "investigation_logs"

    id = Column(Integer, primary_key=True, index=True)
    investigator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    query_type = Column(String(50), nullable=False)  # photo|name|phone|account|address
    query_hash = Column(String(64), nullable=False)
    result_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
