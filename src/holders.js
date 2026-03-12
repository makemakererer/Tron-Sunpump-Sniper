import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function getTokenHolders(contractAddress, start = 0, limit = 10, apiKey) {
  //   const apiUrl = "https://apilist.tronscanapi.com/api/token_trc20/holders";
  const apiUrl = "https://api-v2.sunpump.meme/pump-api/token/holders?page=1&size=10&address=TLcdNJv29Lk4vBT4kRin49if1BeDi18jXE";
  const response = await axios.get(apiUrl, {
    headers: {
      "TRON-PRO-API-KEY": apiKey, // добавляем API-ключ в заголовок
    },
    params: {
      contract_address: contractAddress, // адрес контракта TRC20 токена
      start: start, // начальная позиция для пагинации
      limit: limit, // количество элементов на странице (максимум 10000 в сумме start+limit)
    },
  });

  console.log(response.data);
  return;

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        "TRON-PRO-API-KEY": apiKey, // добавляем API-ключ в заголовок
      },
      params: {
        contract_address: contractAddress, // адрес контракта TRC20 токена
        start: start, // начальная позиция для пагинации
        limit: limit, // количество элементов на странице (максимум 10000 в сумме start+limit)
      },
    });

    return response.data;
  } catch (error) {
    console.error("Ошибка при получении холдеров токена:", error);
    return null;
  }
}

async function calculateAndLogHolderPercentages(contractAddress, apiKey) {
  const data = await getTokenHolders(contractAddress, 0, 10, apiKey);
  return;

  if (data && data.trc20_tokens) {
    const totalSupply = data.trc20_tokens.reduce((acc, holder) => acc + BigInt(holder.balance), BigInt(0));

    console.log(`Общая эмиссия токенов: ${totalSupply}`);

    data.trc20_tokens.forEach((holder) => {
      const balance = BigInt(holder.balance);
      const percentage = (balance * 100n) / totalSupply;

      console.log(`Адрес: ${holder.holder_address}`);
      console.log(`Баланс: ${balance}`);
      console.log(`Процент владения: ${percentage}%`);
      console.log("--------------------------");
    });
  } else {
    console.log("Не удалось получить данные о держателях.");
  }
}

// Пример использования функции
const contractAddress = "TPsZFTjUmq1dHTCXJE5aHLVT5mhudGZX9u"; // адрес вашего токена
const apiKey = process.env.TRONGRID_API_KEY;

calculateAndLogHolderPercentages(contractAddress, apiKey);
