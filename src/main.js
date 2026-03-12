import TronWeb from "tronweb";
import dotenv from "dotenv";
import pLimit from "p-limit";
import axios from "axios";
import lpAbi from "./abi/lpAbi.js";
import launchpadABI from "./abi/launchpad.js";
import multicallABI from "./abi/multicall.js";

dotenv.config();

const tronWeb = new TronWeb({
  fullHost: "https://api.trongrid.io",
  privateKey: process.env.PRI,
});

const launchpadAddr = "TTfvyrAz86hbZk5iDpKD78pqLGgi8C7AAw";
const badAddr = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
const apiKey = process.env.TRONGRID_API_KEY;
const multicallAddress = "TEazPvZwDjDtFeJupyo7QunvnrnUjPH8ED";
let initialTokenCount;

const multicallContract = tronWeb.contract(multicallABI, multicallAddress);
const launchpadContract = tronWeb.contract(launchpadABI, launchpadAddr);

async function getDataFromToken(tokenAddress) {
  const tokenContract = tronWeb.contract(lpAbi, tokenAddress);
  try {
    const owner = await launchpadContract.tokenCreator(tokenAddress).call();
    const ownerBalance = await tokenContract.balanceOf(tronWeb.address.fromHex(owner)).call();
    const supply = await tokenContract.totalSupply().call();
    const virtualPools = await launchpadContract.virtualPools(tokenAddress).call();

    return {
      ownerBalance: tronWeb.toDecimal(ownerBalance), // Приводим к числу
      totalSupply: tronWeb.toDecimal(supply),
      owner: tronWeb.address.fromHex(owner),
      virtualPools,
    };
  } catch (error) {
    console.error("Ошибка при выполнении вызова контрактов:", error);
    throw error;
  }
}

async function processNewToken(addressToken) {
  try {
    let result = await getDataFromToken(addressToken);
    console.log(result.virtualPools.toString());
    let ownerShare = 100 / (result.totalSupply / 1e18 / (result.ownerBalance / 1e18));
    if (ownerShare > 1 && ownerShare < 5) {
      console.log("best token", addressToken);
    }
  } catch (error) {
    console.error("Ошибка при запросе информации о токене:", error.message || error);
    console.log(`Попробую снова через 500 мс...`);
    await delay(500); // Пауза перед повторной попыткой
  }
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listing_launchapd_for_creating_newtokens() {
  try {
    initialTokenCount = await launchpadContract
      .tokenCount()
      .call()
      .then((res) => parseInt(res.toString()));
    console.log(`Начальное количество токенов на лаунчпаде: ${initialTokenCount}`);

    while (true) {
      const newTokenAddressHex = await launchpadContract.tokenAddress(initialTokenCount).call();
      const newTokenAddress = tronWeb.address.fromHex(newTokenAddressHex);

      if (newTokenAddress !== badAddr) {
        console.log(`New token: ${newTokenAddress}`);
        await processNewToken(newTokenAddress);
        initialTokenCount += 1; // Увеличиваем счетчик токенов
      } else {
        await delay(500); // Пауза 500 мс
      }
    }
  } catch (error) {
    console.error("Ошибка при получении нового токена:", error);
  }
}

// const currentBlock = await tronWeb.trx.getCurrentBlock();
// lastProcessedBlock = currentBlock.block_header.raw_data.number;

// console.log(`Начинаем отслеживание событий с блока ${lastProcessedBlock}`);

// setInterval(async () => {
//   try {
//     const currentBlock = await tronWeb.trx.getCurrentBlock();
//     const currentBlockNumber = currentBlock.block_header.raw_data.number;

//     if (currentBlockNumber > lastProcessedBlock) {
//       const events = await tronWeb.getEventResult(launchpad, {
//         eventName: "TokenCreate",
//         fromBlock: lastProcessedBlock + 1,
//         toBlock: currentBlockNumber,
//       });

//       const filteredEvents = events.filter((event) => event.block >= lastProcessedBlock + 1 && event.block <= currentBlockNumber);

//       if (filteredEvents.length > 0) {
//         await processEvents(filteredEvents, contract);
//       }

//       lastProcessedBlock = currentBlockNumber;
//     }
//   } catch (error) {
//     await handleRateLimitError(error);
//   }
// }, interval);
//   } catch (error) {
//     console.error("Ошибка при подписке на блоки:", error);
//   }
// }

async function processEvents(events, contract) {
  for (const event of events) {
    if (!pendingTransactions.has(event.transaction)) {
      pendingTransactions.add(event.transaction);
      console.log(`Событие с транзакцией ${event.transaction} обнаружено. Обработка...`);
      await processTransaction(contract, events.length);
    }
  }
}

async function processTransaction(contract, numberOfEvents) {
  const newTokenCount = await contract
    .tokenCount()
    .call()
    .then((res) => parseInt(res.toString()));
  const newTokens = newTokenCount - initialTokenCount;

  if (newTokens > 0) {
    console.log(`Найдено новых токенов: ${newTokens}`);

    for (let i = 1; i <= newTokens; i++) {
      const tokenIndex = initialTokenCount + i;
      const newTokenAddress = await contract.tokenAddress(tokenIndex).call();
      console.log(`Новый токен адрес (Index ${tokenIndex}): ${newTokenAddress}`);
    }

    initialTokenCount = newTokenCount;

    if (newTokens === numberOfEvents) {
      console.log(`Количество новых евентов (${numberOfEvents}) равно количеству найденных новых токенов (${newTokens}).`);
    } else {
      console.log(`Количество новых евентов (${numberOfEvents}) НЕ равно количеству найденных новых токенов (${newTokens}).`);
    }
  } else {
    console.log("Новых токенов не найдено.");
  }
}

async function handleRateLimitError(error) {
  if (error.response && error.response.status === 403) {
    interval *= 1.5; // Плавное увеличение интервала
    console.log(`Превышен лимит запросов, увеличиваем интервал до ${interval} мс...`);
    await delay(interval);
  } else {
    console.error("Ошибка при обработке блока:", error);
  }
}

listing_launchapd_for_creating_newtokens();
