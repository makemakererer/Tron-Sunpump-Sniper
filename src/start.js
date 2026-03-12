import TronWeb from "tronweb";
import dotenv from "dotenv";
import pLimit from "p-limit";
import lpAbi from "./abi/lpAbi.js";
import launchpadABI from "./abi/launchpad.js";

dotenv.config();

const tronWeb = new TronWeb({
  fullHost: "https://api.trongrid.io",
  privateKey: process.env.PRI,
});

const targetContractAddress = "TKWJdrQkqHisa1X8HUdHEfREvTzw4pMAaY";
const WTRX_USDT_LP = "TFGDbUyP8xez44C76fin3bn3Ss6jugoUwJ";
const WTRX = "TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR";
const launchpad = "TTfvyrAz86hbZk5iDpKD78pqLGgi8C7AAw";

let lastProcessedBlock = 64565637;
let processedTransactions = new Set();
let interval = 500;
let tokenCount;
const limit = pLimit(5);

// Multi-call support
async function multiCall(contractAddress, calls) {
  try {
    const contract = await tronWeb.contract(lpAbi, contractAddress);
    const results = await Promise.all(calls.map((call) => contract[call.method](...call.params).call()));
    return results;
  } catch (error) {
    console.error(`Ошибка при выполнении multi-call на контракте ${contractAddress}:`, error);
    throw error;
  }
}

async function getReserves(pairAddress) {
  try {
    const contract = await tronWeb.contract(lpAbi, pairAddress);
    const reserves = await contract.getReserves().call();
    return {
      reserve0: reserves._reserve0.toString(),
      reserve1: reserves._reserve1.toString(),
    };
  } catch (error) {
    console.error(`Ошибка при получении резервов для ${pairAddress}:`, error);
    throw error;
  }
}

async function getWTRXPriceInUSDT() {
  try {
    const reserves = await getReserves(WTRX_USDT_LP);
    const wtrxReserve = tronWeb.fromSun(reserves.reserve0);
    const usdtReserve = tronWeb.fromSun(reserves.reserve1);
    const wtrxPriceInUSDT = usdtReserve / wtrxReserve;
    console.log(`1 WTRX = ${wtrxPriceInUSDT} USDT`);
    return wtrxPriceInUSDT;
  } catch (error) {
    console.error("Ошибка при получении цены WTRX в USDT:", error);
    return null;
  }
}

async function getMultipleReserves(pairAddresses) {
  try {
    const calls = pairAddresses.map((pairAddress) => ({
      method: "getReserves",
      params: [],
    }));

    const results = await multiCall(pairAddresses[0], calls); // Используем первый адрес для контракта, предполагая что ABI одинаковое.

    return results.map((result, index) => ({
      pairAddress: pairAddresses[index],
      reserve0: result._reserve0.toString(),
      reserve1: result._reserve1.toString(),
    }));
  } catch (error) {
    console.error("Ошибка при выполнении multi-call для получения резервов:", error);
    return null;
  }
}

async function listing_launchapd_for_creating_newtokens() {
  let contract = await tronWeb.contract(launchpadABI, launchpad);
  tokenCount = await contract.tokenCount().call().toString();
  try {
    const currentBlock = await tronWeb.trx.getCurrentBlock();
    lastProcessedBlock = currentBlock.block_header.raw_data.number;

    console.log(`Начинаем отслеживание событий с блока ${lastProcessedBlock}`);

    setInterval(async () => {
      try {
        const currentBlock = await tronWeb.trx.getCurrentBlock();
        const currentBlockNumber = currentBlock.block_header.raw_data.number;
        console.log(currentBlockNumber, "currentBlockNumber");

        if (currentBlockNumber > lastProcessedBlock) {
          const events = await tronWeb.getEventResult(launchpad, {
            eventName: "TokenCreate",
            fromBlock: lastProcessedBlock + 1,
            toBlock: currentBlockNumber,
          });

          const filteredEvents = events.filter((event) => event.block >= lastProcessedBlock + 1 && event.block <= currentBlockNumber);

          if (filteredEvents.length > 0) {
            console.log(filteredEvents);
            if (filteredEvents.length === "1") {
              console.log("hereeee");
              tokenCount += 1;
              let newPair = await contract.tokenAddress(tokenCount).call();
              console.log(newPair);
              await filter_for_scam(filteredEvents);
            }
          }

          lastProcessedBlock = currentBlockNumber;
        }
      } catch (error) {
        console.error("Ошибка при обработке блока:", error);
        if (error.response && error.response.status === 403) {
          interval *= 2; // Увеличиваем интервал в 2 раза
          console.log(`Превышен лимит запросов, увеличиваем интервал до ${interval} мс...`);
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      }
    }, interval);
  } catch (error) {
    console.error("Ошибка при подписке на блоки:", error);
  }
}

async function filter_for_scam(events) {
  for (let i = 0; i < events.length; i++) {
    if (events[i].unconfirmed) {
      console.log(`Событие ${i} еще не подтверждено. Ожидание подтверждения...`);

      try {
        const transactionInfo = await waitForConfirmation(events[i].transaction);

        if (transactionInfo) {
          // Обработка подтвержденной транзакции и событий
          console.log(`Подтвержденная транзакция:`, transactionInfo);
        }
      } catch (error) {
        console.error(`Не удалось дождаться подтверждения транзакции ${events[i].transaction}:`, error);
      }
    } else {
      console.log(`Событие ${i} подтверждено. Обработка...`);
      const transactionInfo = await tronWeb.trx.getTransactionInfo(events[i].transaction);
      console.log(`Информация о транзакции для события ${i}:`, transactionInfo);
      // Ваша логика для проверки и анализа
    }
  }
}
//   const WTRX = "TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR";
//   const pairAddresses = events.map((event) => TronWeb.address.fromHex(event.result.pair));
//   const reservesData = await getMultipleReserves(pairAddresses);
//   const wtrxPriceInUSDT = await getWTRXPriceInUSDT();

//   if (reservesData && wtrxPriceInUSDT) {
//     for (let i = 0; i < events.length; i++) {
//       const event = events[i];
//       const reserves = reservesData[i];

//       if (!processedTransactions.has(event.transaction)) {
//         console.log("Новое событие:");

//         const tronToken0 = TronWeb.address.fromHex(event.result.token0);
//         const tronToken1 = TronWeb.address.fromHex(event.result.token1);
//         const tronPairAddress = reserves.pairAddress;

//         console.log("Token 0 (Tron Address):", tronToken0);
//         console.log("Token 1 (Tron Address):", tronToken1);
//         console.log("Pair (Tron Address):", tronPairAddress);

//         let reserveWTRX;

//         // Определяем, какой из токенов является WTRX, и приводим другой токен к 18 decimals
//         if (tronToken0 === WTRX) {
//           reserveWTRX = tronWeb.fromSun(reserves.reserve0);
//         } else if (tronToken1 === WTRX) {
//           reserveWTRX = tronWeb.fromSun(reserves.reserve1);
//         } else {
//           console.log("Ни один из токенов не является WTRX, пропускаем событие.");
//           continue;
//         }

//         let liquidityValueInUSDT = reserveWTRX * wtrxPriceInUSDT * 2;

//         console.log(`Liquidity Value for Pair ${tronPairAddress}: $${liquidityValueInUSDT}`);

//         processedTransactions.add(event.transaction);
//       }
//     }
//   }
// }

listing_launchapd_for_creating_newtokens();
