// rippling_demo.js
const xrpl = require("xrpl");

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  
  async function submitTx(wallet, tx) {
    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const res = await client.submitAndWait(signed.tx_blob);
    const code = res.result?.meta?.TransactionResult;
    if (code !== "tesSUCCESS") {
      throw new Error(`Transaction failed: ${code ?? "unknown"} for ${tx.TransactionType}`);
    }
    return res;
  }

  // Fund wallets
  const { wallet: issuer } = await client.fundWallet();
  const { wallet: A } = await client.fundWallet();
  const { wallet: B } = await client.fundWallet();

  console.log("Issuer:", issuer.address);
  console.log("Trader A:", A.address);
  console.log("Trader B:", B.address);

  const AAA = "AAA";
  const BBB = "BBB";
  const IOU = (currency, issuerAddr, value) => ({ currency, issuer: issuerAddr, value });

  // 1) Habilitar Default Ripple na conta do emissor
  // DefaultRipple é uma Account flag; no xrpl.js use as "asf" flags.
  // A flag DefaultRipple corresponde a asfDefaultRipple (valor 8).
  // xrpl.js aceita: SetFlag: xrpl.AccountSetAsfFlag.asfDefaultRipple (se disponível) ou SetFlag: 8.
  // Usamos 8 para compatibilidade.
  await submitTx(issuer, {
    TransactionType: "AccountSet",
    Account: issuer.address,
    SetFlag: 8 // asfDefaultRipple
  });
  await sleep(300);

  // Função para criar trust line e garantir que No Ripple esteja DESATIVADO (tfClearNoRipple)
  async function trustAllowRipple(holder, currency, limit) {
    // Primeiro cria/ajusta a trust line com o limite
    await submitTx(holder, {
      TransactionType: "TrustSet",
      Account: holder.address,
      LimitAmount: { currency, issuer: issuer.address, value: limit }
    });
    await sleep(200);
    // Agora limpa a flag No Ripple, se por acaso estiver ativa
    await submitTx(holder, {
      TransactionType: "TrustSet",
      Account: holder.address,
      LimitAmount: { currency, issuer: issuer.address, value: limit },
      Flags: xrpl.TrustSetFlags.tfClearNoRipple
    });
  }

  // 2) Trustlines com No Ripple DESATIVADO
  await trustAllowRipple(A, AAA, "1000000");
  await sleep(200);
  await trustAllowRipple(A, BBB, "1000000");
  await sleep(200);
  await trustAllowRipple(B, AAA, "1000000");
  await sleep(200);
  await trustAllowRipple(B, BBB, "1000000");
  await sleep(300);

  // Emitir tokens
  async function issue(to, currency, value) {
    const tx = {
      TransactionType: "Payment",
      Account: issuer.address,
      Destination: to,
      Amount: IOU(currency, issuer.address, value)
    };
    await submitTx(issuer, tx);
  }

  // Distribuição: A tem AAA, B tem BBB
  await issue(A.address, AAA, "10000");
  await sleep(200);
  await issue(B.address, BBB, "10000");
  await sleep(300);

  // 3) Demonstração de rippling: A envia AAA para B através do issuer
  // Como ambos têm trust lines para AAA do mesmo issuer e No Ripple está desativado,
  // o pagamento “rippla” via o issuer (indireto).
  console.log("Payment A -> B of 500 AAA (rippling via issuer)...");
  await submitTx(A, {
    TransactionType: "Payment",
    Account: A.address,
    Destination: B.address,
    Amount: IOU(AAA, issuer.address, "500")
    // Sem Path especificado pois é direto via mesmo issuer; com múltiplos emissores, o Pathfinding cuidaria
  });
  await sleep(500);

  // Helper para ver o livro AAA/BBB (DEX) - opcional, não é rippling
  async function orderbook(baseCurrency, baseIssuer, counterCurrency, counterIssuer) {
    const res = await client.request({
      command: "book_offers",
      taker: issuer.address,
      ledger_index: "validated",
      limit: 20,
      taker_gets: { currency: baseCurrency, issuer: baseIssuer },
      taker_pays: { currency: counterCurrency, issuer: counterIssuer }
    });
    return res.result?.offers ?? [];
  }

  // Ofertas complementares (DEX) - permanece para comparação
  const offerA = {
    TransactionType: "OfferCreate",
    Account: A.address,
    TakerGets: IOU(AAA, issuer.address, "100"), // A entrega 100 AAA
    TakerPays: IOU(BBB, issuer.address, "200")  // A quer 200 BBB
  };

  const offerB = {
    TransactionType: "OfferCreate",
    Account: B.address,
    TakerGets: IOU(BBB, issuer.address, "200"), // B entrega 200 BBB
    TakerPays: IOU(AAA, issuer.address, "100")  // B quer 100 AAA
  };
  
  console.log("Posting complementary offers (DEX)...");
  await submitTx(A, offerA);
  await sleep(500);
  await submitTx(B, offerB);
  await sleep(700);

  const bookAB = await orderbook(AAA, issuer.address, BBB, issuer.address);
  console.log("Orderbook AAA/BBB size:", bookAB.length);

  async function balances(addr) {
    const res = await client.request({
      command: "account_lines",
      account: addr,
      ledger_index: "validated"
    });
    const lines = res.result?.lines ?? [];
    const findLine = (code) => lines.find((l) => l.currency === code && l.account === issuer.address);
    return {
      AAA: findLine(AAA)?.balance ?? "0",
      BBB: findLine(BBB)?.balance ?? "0"
    };
  }

  const balA = await balances(A.address);
  const balB = await balances(B.address);
  console.log("Trader A balances:", balA);
  console.log("Trader B balances:", balB);

  console.log("Done.");
  await client.disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
