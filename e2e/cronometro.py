"""Cronômetro da sessão em navegador real (tempos medidos com espera REAL).

Serve aos dois laboratórios: `--app bunpou` ou `--app katsuyou`.

Uma aba em segundo plano é reproduzida pelos dois efeitos que o navegador
produz de fato: o estado `hidden` (com o evento visibilitychange, que é o
que o código observa) e o CONGELAMENTO dos timers da página
(Page.setWebLifecycleState 'frozen' do Chromium — o que acontece com abas em
segundo plano e com o navegador minimizado). Fechar a aba e atualizar a
página são reais. Nenhuma conta é usada; o progresso vive num perfil
temporário do navegador.

Uso (no Katsuyou Lab; o mesmo script está em bunpou-lab/tests/):
  npm run build && python3 -m http.server 8767 --bind 127.0.0.1 --directory dist
  python e2e/cronometro.py --app katsuyou --url http://127.0.0.1:8767/
  (--rapido encurta as esperas para 20/10/10/20 s)
Navegador: Chromium do Playwright, ou o executável em $BROWSER_PATH.
"""
import sys, os, time, json, argparse, tempfile, shutil
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--app', choices=['bunpou', 'katsuyou'], required=True)
ap.add_argument('--url', required=True)
ap.add_argument('--rapido', action='store_true')
A = ap.parse_args()
ESPERA = dict(aba=20, congelado=10, outroapp=10, fechada=20) if A.rapido else dict(aba=120, congelado=60, outroapp=30, fechada=90)

BUN = A.app == 'bunpou'
START = ("()=>{ setSessionMin(15); startSession(); }" if BUN else
         "()=>window.KatsuyouApp.startSession({mode:'mixed',limitKind:'time',minutes:30,length:60})")
READ = ("()=>{ clockPulse(); return V.activeMs; }" if BUN else
        "()=>window.KatsuyouApp.session ? window.KatsuyouApp.session.elapsedMs : null")
SAVED = ("()=>{ const r=localStorage.getItem(runKey()); return r?JSON.parse(r).activeMs:null; }" if BUN else
         "()=>{ const s=JSON.parse(localStorage.getItem('katsuyou_lab_progress_v1')||'null'); return s&&s.resume?s.resume.elapsedMs:null; }")
RESUME = ("()=>resumeSavedRun()" if BUN else
          "()=>document.querySelector('[data-resume=\"continue\"]').click()")
CARD = "()=>!!document.querySelector('.resume-card')"
HIDE = """()=>{ window.__vis='hidden'; Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__vis});
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__vis==='hidden'});
  document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur')); }"""
SHOW = "()=>{ window.__vis='visible'; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); }"

results = []
def check(name, cond, info=''):
    results.append((name, bool(cond), info))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{info}]' if info else ''), flush=True)

exe = os.environ.get('BROWSER_PATH')
tmp = tempfile.mkdtemp(prefix='cronometro-')
try:
    with sync_playwright() as p:
        kw = dict(user_data_dir=tmp, headless=True, viewport={'width': 1100, 'height': 860})
        if exe: kw['executable_path'] = exe
        ctx = p.chromium.launch_persistent_context(**kw)
        pg = ctx.pages[0] if ctx.pages else ctx.new_page()
        pg.goto(A.url); pg.wait_for_timeout(700)
        pg.evaluate("()=>localStorage.clear()"); pg.reload(); pg.wait_for_timeout(700)
        pg.evaluate(START); pg.wait_for_timeout(300)

        # 1. aba visível conta
        t0 = pg.evaluate(READ); w0 = time.time(); pg.wait_for_timeout(5000)
        d = pg.evaluate(READ) - t0; real = (time.time() - w0) * 1000
        check('aba visível: o tempo corre', abs(d - real) < 1500, f'{d/1000:.1f} s medidos em {real/1000:.1f} s')

        # 2. trocar de aba: outra aba na frente, esta oculta e com timers congelados
        outra = ctx.new_page(); outra.goto('about:blank'); outra.bring_to_front()
        t0 = pg.evaluate(READ); pg.evaluate(HIDE)
        cdp = ctx.new_cdp_session(pg); cdp.send('Page.setWebLifecycleState', {'state': 'frozen'})
        w0 = time.time(); time.sleep(ESPERA['aba'])
        cdp.send('Page.setWebLifecycleState', {'state': 'active'}); pg.bring_to_front(); pg.evaluate(SHOW)
        real = (time.time() - w0) * 1000; d = pg.evaluate(READ) - t0
        check(f"trocar de aba por {ESPERA['aba']} s: o tempo em segundo plano é contado", abs(d - real) < 2500,
              f'{d/1000:.1f} s medidos em {real/1000:.1f} s reais')
        outra.close()

        # 3. navegador minimizado / sistema suspendeu os timers (sem eventos)
        t0 = pg.evaluate(READ); cdp.send('Page.setWebLifecycleState', {'state': 'frozen'})
        w0 = time.time(); time.sleep(ESPERA['congelado'])
        cdp.send('Page.setWebLifecycleState', {'state': 'active'})
        real = (time.time() - w0) * 1000; d = pg.evaluate(READ) - t0
        check(f"minimizado (timers congelados {ESPERA['congelado']} s): reconciliado na volta", abs(d - real) < 2500,
              f'{d/1000:.1f} s medidos em {real/1000:.1f} s reais')

        # 4. outro aplicativo à frente (janela perde foco e fica oculta)
        t0 = pg.evaluate(READ); pg.evaluate(HIDE); w0 = time.time(); time.sleep(ESPERA['outroapp']); pg.evaluate(SHOW)
        real = (time.time() - w0) * 1000; d = pg.evaluate(READ) - t0
        check(f"outro aplicativo por {ESPERA['outroapp']} s: o tempo continua", abs(d - real) < 2500,
              f'{d/1000:.1f} s medidos em {real/1000:.1f} s reais')

        # 5. fechar a aba: a sessão é salva e o período fechado NÃO conta
        antes = pg.evaluate(READ)
        pg.close(run_before_unload=True); fechou = time.time()
        time.sleep(ESPERA['fechada'])
        pg = ctx.new_page(); pg.goto(A.url); pg.wait_for_timeout(800)
        salvo = pg.evaluate(SAVED)
        check('fechar a aba: a tela inicial oferece "Continuar sessão anterior"', pg.evaluate(CARD))
        check('fechar a aba: tempo salvo = tempo no fechamento', salvo is not None and abs(salvo - antes) < 1500,
              f'salvo {salvo/1000:.1f} s · no fechamento {antes/1000:.1f} s')
        pg.evaluate(RESUME); pg.wait_for_timeout(400)
        ret = pg.evaluate(READ); fora = (time.time() - fechou) * 1000
        check(f"retomar: continua do tempo salvo; os {fora/1000:.0f} s fechada não contam", abs(ret - salvo) < 2000,
              f'retomado em {ret/1000:.1f} s · salvo {salvo/1000:.1f} s')
        t0 = pg.evaluate(READ); pg.wait_for_timeout(5000); d = pg.evaluate(READ) - t0
        check('depois de retomar o relógio volta a correr, sem duplicar', 4300 < d < 6000, f'+{d/1000:.1f} s em 5 s')

        # 6. atualizar a página no meio da sessão
        antes = pg.evaluate(READ); pg.reload(); r0 = time.time(); pg.wait_for_timeout(1500)
        check('atualizar: a sessão não é retomada sozinha', pg.evaluate(CARD))
        salvo = pg.evaluate(SAVED); pg.evaluate(RESUME); pg.wait_for_timeout(300)
        ret = pg.evaluate(READ)
        check('atualizar: retoma do tempo salvo, sem contar a página descarregada', abs(ret - salvo) < 2000 and abs(salvo - antes) < 1500,
              f'antes {antes/1000:.1f} s · salvo {salvo/1000:.1f} s · retomado {ret/1000:.1f} s · recarga {time.time()-r0:.1f} s')

        # 7. barras de rolagem estáveis enquanto o relógio anda
        amostras = []
        for _ in range(10):
            amostras.append(pg.evaluate("()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth,document.documentElement.scrollHeight,(document.querySelector('.topbar')||{}).offsetHeight]"))
            pg.wait_for_timeout(400)
        check('sem oscilação de largura, altura ou barra de rolagem com o relógio andando', len(set(map(tuple, amostras))) == 1, str(amostras[0]))
        ctx.close()
finally:
    shutil.rmtree(tmp, ignore_errors=True)
fails = [r for r in results if not r[1]]
print(f"\n{len(results)-len(fails)}/{len(results)} verificações passaram ({A.app})")
sys.exit(1 if fails else 0)
