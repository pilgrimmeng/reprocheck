from pathlib import Path
import json
import shutil
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path=shutil.which("chromium"), args=["--no-sandbox"])
    page=browser.new_page(viewport={"width":1440,"height":900}, accept_downloads=True)
    errors=[]; net=[]
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: net.append(request.url) if request.url.startswith(("http:","https:")) else None)
    page.goto((root/"index.html").as_uri())
    expect(page.locator("#empty")).to_be_visible()
    page.locator("#demo-good").click()
    expect(page.locator("#results .flag.pass")).to_have_count(5)
    page.locator("#demo-gap").click()
    expect(page.locator("#results .flag.missing")).to_have_count(3)
    expect(page.locator("#results")).to_contain_text("scripts/plot.py")
    with page.expect_download() as d:
        page.locator("#export-md").click()
    assert "figures/fig2.svg" in d.value.path().read_text()
    with page.expect_download() as d:
        page.locator("#export-json").click()
    assert json.loads(d.value.path().read_text())["schema"]=="reprocheck/1"
    page.locator("#archive").set_input_files(root/"examples"/"complete-example.zip")
    expect(page.locator("#summary")).to_contain_text("complete-example.zip")
    expect(page.locator("#results .flag.pass")).to_have_count(5)
    page.locator("#archive").set_input_files({"name":"wrong.zip","mimeType":"application/zip","buffer":b"not a ZIP archive"})
    expect(page.locator("#status")).to_contain_text("32 MiB")
    expect(page.locator("#report")).to_be_hidden()
    page.set_viewport_size({"width":375,"height":812})
    page.locator("#demo-gap").click()
    expect(page.locator("#results .flag.missing")).to_have_count(3)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    assert not net,net
    assert not errors,errors
    print("Chromium: file://, both examples, ZIP upload, error reset, Markdown/JSON downloads, and responsive 375 px passed. 0 network requests.")
    browser.close()
