from __future__ import annotations

"""
Email generation service.

Generates email drafts from meeting summaries and supports SMTP sending.
"""

import os
import smtplib
from email.message import EmailMessage


def generate_email_draft(
    summary: dict,
    template: str = "meeting_summary",
    recipients: list[str] | None = None,
) -> dict:
    """
    Generate email draft from meeting summary.

    Templates:
    - meeting_summary: Standard meeting recap
    - follow_up: Customer follow-up
    - task_assignment: Task assignment notification
    """
    recipients = recipients or []

    if template == "meeting_summary":
        subject = f"会议纪要：{summary.get('abstract', '会议总结')[:50]}"
        body = _generate_summary_body(summary)
    elif template == "follow_up":
        subject = f"会议跟进：{summary.get('abstract', '')[:50]}"
        body = _generate_followup_body(summary)
    elif template == "task_assignment":
        subject = "任务分配通知"
        body = _generate_task_body(summary)
    else:
        subject = "会议相关通知"
        body = summary.get("abstract", "")

    return {
        "subject": subject,
        "body": body,
        "recipients": recipients,
        "attachments": [],
        "template": template,
    }


def _generate_summary_body(summary: dict) -> str:
    lines = [
        "您好，",
        "",
        "以下是本次会议的纪要摘要：",
        "",
        f"摘要：{summary.get('abstract', '')}",
        "",
    ]

    decisions = summary.get("decisions") or []
    if decisions:
        lines.append("关键决策：")
        for decision in decisions:
            lines.append(f"- {decision}")
        lines.append("")

    action_items = summary.get("action_items") or []
    if action_items:
        lines.append("待办事项：")
        for item in action_items:
            assignee = item.get("assignee") or "待定"
            due = item.get("due_date") or "待定"
            lines.append(f"- {item.get('title', '未命名任务')}（负责人：{assignee}，截止：{due}）")
        lines.append("")

    lines.extend(
        [
            "如有补充，请直接回复本邮件。",
            "",
            "此致",
            "MeetMind",
        ]
    )
    return "\n".join(lines)


def _generate_followup_body(summary: dict) -> str:
    lines = [
        "您好，",
        "",
        "感谢参会，以下是本次会议的后续跟进事项：",
        "",
    ]

    for item in summary.get("action_items") or []:
        lines.append(f"- {item.get('title', '未命名任务')}")

    lines.extend(
        [
            "",
            "如有问题，请及时沟通。",
            "",
            "此致",
            "MeetMind",
        ]
    )
    return "\n".join(lines)


def _generate_task_body(summary: dict) -> str:
    lines = [
        "您好，",
        "",
        "以下是新分配给您的任务：",
        "",
    ]

    for item in summary.get("action_items") or []:
        due = item.get("due_date") or "待定"
        lines.append(f"{item.get('title', '未命名任务')}")
        lines.append(f"截止日期：{due}")
        lines.append("")

    lines.extend(
        [
            "请根据进度及时更新任务状态。",
            "",
            "此致",
            "MeetMind",
        ]
    )
    return "\n".join(lines)


def send_email(subject: str, body: str, recipients: list[str]) -> dict:
    """
    Send email via SMTP. Requires SMTP_HOST/SMTP_PORT/SMTP_USERNAME/SMTP_PASSWORD/SMTP_FROM.
    """
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM", username)

    if not host or not username or not password or not sender:
        raise RuntimeError(
            "SMTP 未配置，请设置 SMTP_HOST、SMTP_PORT、SMTP_USERNAME、SMTP_PASSWORD、SMTP_FROM。"
        )

    if not recipients:
        raise RuntimeError("收件人列表为空。")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)
    msg.set_content(body)

    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(username, password)
        server.send_message(msg)

    return {"status": "sent", "recipients": recipients}
