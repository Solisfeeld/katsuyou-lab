"""Sessão interrompida do Katsuyou Lab em navegador real (SEM conta).

Perfil persistente num diretório temporário: fechar o navegador fecha o
processo de verdade, e reabrir encontra o mesmo localStorage.

Uso:
  npm run build && python3 -m http.server 8767 --bind 127.0.0.1 --directory dist
  python e2e/retomada.py [url]
Navegador: Chromium do Playwright, ou o executável em $BROWSER_PATH.
"""
import sys, os, json, tempfile, shutil
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8767/'
KEY = 'katsuyou_lab_progress_v1'
results = []
def check(name, cond, info=''):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{info}]' if info else ''))

def state(pg):
    return pg.evaluate(f"()=>JSON.parse(localStorage.getItem('{KEY}')||'null')")
def answer(pg, txt):
    pg.fill('input.answer', txt); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
def click(pg, sel):
    pg.click(sel); pg.wait_for_timeout(200)

exe = os.environ.get('BROWSER_PATH')
tmp = tempfile.mkdtemp(prefix='kl-retomada-')
try:
    with sync_playwright() as p:
        def browser():
            kw = dict(user_data_dir=tmp, headless=True, viewport={'width': 1000, 'height': 900})
            if exe: kw['executable_path'] = exe
            return p.chromium.launch_persistent_context(**kw)
        def first(ctx):
            pg = ctx.pages[0] if ctx.pages else ctx.new_page()
            pg.goto(URL); pg.wait_for_timeout(600); return pg

        ctx = browser(); pg = first(ctx)
        pg.evaluate("()=>localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500)
        pg.evaluate("""()=>window.KatsuyouApp.startSession({mode:'review',limitKind:'time',minutes:30,length:60,
           queue:[{verbId:'nomimasu',form:'te'},{verbId:'tabemasu',form:'nai'},{verbId:'kakimasu',form:'ta'},
                  {verbId:'mimasu',form:'te'},{verbId:'ikimasu',form:'ta'},{verbId:'kaimasu',form:'nai'}]})""")
        pg.wait_for_timeout(200)
        answer(pg, 'のんで'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
        answer(pg, 'たべた')                             # erro → reforço na fila
        pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
        pg.fill('input.answer', 'かい'); pg.wait_for_timeout(600)   # rascunho gravado
        st = state(pg)
        fila = [(i['verbId'], i['form'], bool(i.get('requeued'))) for i in st['resume']['rest']]
        pairs0 = json.dumps(st['pairs'], sort_keys=True)
        check('o erro entrou na fila de reforço', any(r for _, _, r in fila))
        # 23:15 de sessão
        pg.evaluate("()=>{ const s=window.KatsuyouApp.session; s.startedAt=Date.now()-(23*60+15)*1000; s._beat=Date.now(); s.saveQuiet(); }")

        # ---------- fechar e reabrir o navegador ----------
        ctx.close(); ctx = browser(); pg = first(ctx)
        t = pg.inner_text('body')
        check('reabrir o navegador mostra "Continuar sessão anterior"', 'Continuar sessão anterior' in t)
        check('não retoma sozinho', pg.evaluate("window.KatsuyouApp.view") == 'home')
        check('cartão com respondidas e tempo', '2 questões respondidas' in t and '23:15 de sessão' in t, t[t.find('Continuar sessão anterior'):][:140].replace('\n', ' | '))
        # três dias fechado
        pg.evaluate(f"""()=>{{ const s=JSON.parse(localStorage.getItem('{KEY}')); s.resume.savedAt-=3*86400000;
            localStorage.setItem('{KEY}',JSON.stringify(s)); }}""")
        pg.reload(); pg.wait_for_timeout(500)
        click(pg, '[data-resume="continue"]')
        r = pg.evaluate("""()=>{ const s=window.KatsuyouApp.session; return {kana:document.querySelector('.q-prompt [data-kana]').dataset.kana,
             draft:document.querySelector('input.answer').value, el:Math.round(s.elapsedMs/1000),
             fila:s.queue.map(i=>[i.verbId,i.form,!!i.requeued])}; }""")
        check('retoma na mesma questão com o texto digitado', r['kana'] == 'かきます' and r['draft'] == 'かい', str(r['kana']) + ' ' + r['draft'])
        check('ordem da fila e reforço preservados', [tuple(x) for x in r['fila']] == fila)
        check('cronômetro parte de 23:15 (os 3 dias não contam)', 1395 <= r['el'] <= 1397, f"{r['el']} s")
        check('retomar não reaplica respostas', json.dumps(state(pg)['pairs'], sort_keys=True) == pairs0)

        # ---------- página oculta NÃO pausa ----------
        pg.evaluate("""()=>{ window.__v='hidden'; Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__v});
                         document.dispatchEvent(new Event('visibilitychange')); window.__e=window.KatsuyouApp.session.elapsedMs; }""")
        pg.wait_for_timeout(2500)
        oc = pg.evaluate("()=>window.KatsuyouApp.session.elapsedMs-window.__e")
        pg.evaluate("()=>{ window.__v='visible'; document.dispatchEvent(new Event('visibilitychange')); }")
        check('página oculta: o cronômetro CONTINUA', 2300 <= oc <= 3200, f'{oc} ms em 2,5 s')

        # ---------- atualizar durante o feedback ----------
        answer(pg, 'かいた')
        before = json.dumps(state(pg)['pairs'], sort_keys=True)
        pg.reload(); pg.wait_for_timeout(500)
        click(pg, '[data-resume="continue"]')
        fb = pg.evaluate("()=>({phase:window.KatsuyouApp.session.phase, fb:!!document.querySelector('.fb')})")
        check('atualizar durante o feedback: volta ao mesmo feedback', fb['phase'] == 'feedback' and fb['fb'])
        check('sem dupla contagem no progresso', json.dumps(state(pg)['pairs'], sort_keys=True) == before)

        # ---------- duas abas ----------
        pg2 = ctx.new_page(); pg2.goto(URL); pg2.wait_for_timeout(500)
        click(pg2, '[data-resume="continue"]'); pg.wait_for_timeout(400)
        check('duas abas: a antiga larga a sessão', pg.evaluate("window.KatsuyouApp.session===null&&window.KatsuyouApp.view==='home'"))
        check('a aba antiga avisa o motivo', 'Esta sessão continuou em outra aba.' in pg.inner_text('body'))
        pg.close(); pg = pg2

        # ---------- concluir normalmente ----------
        n0 = len(state(pg)['sessions'])
        for _ in range(20):
            if pg.evaluate("window.KatsuyouApp.view") != 'practice': break
            ph = pg.evaluate("window.KatsuyouApp.session&&window.KatsuyouApp.session.phase")
            if ph == 'asking':
                cur = pg.evaluate("(()=>{const c=window.KatsuyouApp.session.current; return c.verb[c.form];})()")
                answer(pg, cur)
            else:
                pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
        st = state(pg)
        check('sessão retomada termina normalmente', pg.evaluate("window.KatsuyouApp.view") == 'sessionEnd')
        check('concluída: registrada uma vez e sem sessão salva', len(st['sessions']) == n0 + 1 and st['resume'] is None)

        # ---------- descartar ----------
        pg.evaluate("()=>window.KatsuyouApp.startSession({mode:'review',limitKind:'count',length:2,queue:[{verbId:'nomimasu',form:'ta'},{verbId:'mimasu',form:'nai'}]})")
        answer(pg, 'のんだ')
        pairs1 = json.dumps(state(pg)['pairs'], sort_keys=True)
        pg.reload(); pg.wait_for_timeout(500)
        click(pg, '[data-resume="discard"]')
        check('descartar pede confirmação', pg.locator('.overlay.show').count() == 1)
        click(pg, '[data-dialog="ok"]')
        st = state(pg)
        check('descartar remove a sessão e mantém as respostas', st['resume'] is None and json.dumps(st['pairs'], sort_keys=True) == pairs1)
        ctx.close()
finally:
    shutil.rmtree(tmp, ignore_errors=True)

fails = [n for n, ok in results if not ok]
print(f'\n{len(results)-len(fails)}/{len(results)} verificações passaram')
sys.exit(1 if fails else 0)
