#!/usr/bin/env python3
"""
SE Ranking Technical SEO Audit & Automation helper for originfacts.com.
Integrates with /opt/seranking to monitor, inspect, and trigger audits for Audit ID 414250.
"""
import sys
import os

sys.path.insert(0, '/opt/seranking')
try:
    from client import SERankingClient
except ImportError:
    print("Error: Could not import SERankingClient from /opt/seranking", file=sys.stderr)
    sys.exit(1)

AUDIT_ID = 414250

def main():
    client = SERankingClient()
    action = sys.argv[1] if len(sys.argv) > 1 else 'report'

    if action == 'recheck':
        mode = sys.argv[2] if len(sys.argv) > 2 else 'standard'
        print(f"Triggering SE Ranking audit crawl ({mode}) for originfacts.com (Audit ID: {AUDIT_ID})...")
        res = client.recheck_audit(AUDIT_ID, mode=mode)
        print("✅ Recheck triggered successfully.")
    elif action == 'status':
        data = client.get_audit_status(AUDIT_ID)
        print("📊 CRAWL STATUS:")
        print(f"  • Status:        {data.get('status', 'unknown').upper()}")
        print(f"  • Pages Crawled: {data.get('total_pages', 0)}")
        print(f"  • Errors:        {data.get('total_errors', 0)}")
        print(f"  • Warnings:      {data.get('total_warnings', 0)}")
        print(f"  • Started:       {data.get('start_time', 'N/A')}")
        print(f"  • Completed:     {data.get('audit_time', 'N/A')}")
    elif action == 'report':
        data = client.get_audit_report(AUDIT_ID)
        print(f"📋 Overall Score: {data.get('score_percent', 'N/A')}/100")
        print(f"  • Total Errors:   {data.get('total_errors', 0)}")
        print(f"  • Total Warnings: {data.get('total_warnings', 0)}")
        print(f"  • Total Notices:  {data.get('total_notices', 0)}")
    elif action == 'pages':
        code = sys.argv[2] if len(sys.argv) > 2 else 'http4xx'
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 15
        data = client.get_issue_pages(AUDIT_ID, code)
        urls = data.get("urls", [])
        print(f"Affected URLs for issue '{code}' (Total: {len(urls)}):")
        for i, u in enumerate(urls[:limit], 1):
            print(f"  {i}. {u}")
    else:
        print(f"Usage: {sys.argv[0]} [report|status|recheck|pages <code>]")

if __name__ == '__main__':
    main()
