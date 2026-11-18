import { Request, Response } from "express"
import axios from "axios"
import logger from "../logger"
import "dotenv/config"
import apifunctions from "../functions/apifunctions"
import { v4 } from "uuid"
import allfunctions from "../functions/allfunctions"
import { gameByCode, gameCatalog, gameUnavailableReason } from "../game-catalog"

function publicApiBaseUrl(): string {
   const raw = (process.env.DOMINIO_API ?? "").trim().replace(/\/$/, "")
   if (!raw) throw new Error("Configure DOMINIO_API no arquivo .env")
   return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin
}

function buildLaunchUrl(codegame: number, token: string): string {
   const base = publicApiBaseUrl()
   const q = new URLSearchParams({
      operator_token: "Zm9saWFiZXQ=",
      btt: "1",
      l: "pt",
      t: token,
      api: base,
   })
   if (process.env.AMBIENTE === "DEV" && token === "local-demo-token") q.set("localDemo", "1")
   return `${base}/${codegame}/index.html?${q.toString()}`
}

async function sendGameCatalog(res: Response, token: string | undefined) {
   res.setHeader("Cache-Control", "no-store")
   try {
      if (!token || !(await allfunctions.getuserbytoken(token)).length) {
         return res.status(401).json({ status: 0, message: "Token de sessão inválido ou ausente." })
      }
      const games = gameCatalog.map(game => {
         const reason = gameUnavailableReason(game.game_id)
         return {
            ...game,
            provider_code: "PGSOFT",
            available: !reason,
            launch_url: reason ? null : buildLaunchUrl(game.game_id, token),
            ...(reason ? { reason } : {}),
         }
      })
      return res.json({
         status: 1,
         total: games.length + 1,
         games: [...games, {
            game_id: null,
            game_code: "rainbow-jackpots-megaways",
            name: "Rainbow Jackpots Megaways",
            provider_code: "REDTIGER",
            available: false,
            launch_url: null,
            reason: "O launcher depende de serviços externos e não usa a sessão desta API.",
         }],
      })
   } catch (error) {
      logger.error(error)
      return res.status(500).json({ status: 0, message: "Não foi possível carregar o catálogo." })
   }
}

export default {
   async games(req: Request, res: Response) {
      const token = req.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1]
      return sendGameCatalog(res, token)
   },
   async demoGames(req: Request, res: Response) {
      const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "")
      if (process.env.AMBIENTE !== "DEV" || !loopback || !["localhost", "127.0.0.1", "[::1]"].includes(req.hostname)) {
         return res.sendStatus(404)
      }
      return sendGameCatalog(res, "local-demo-token")
   },
   async launchgame(req: Request, res: Response) {
      const agentToken = req.body.agentToken
      const secretKey = req.body.secretKey
      const user_code = req.body.user_code
      const game_type = req.body.game_type
      const provider_code = req.body.provider_code
      const game_code = req.body.game_code
      const user_balance: number = req.body.user_balance

      try {
         if (!user_code) {
            res.send({
               status: "error",
               message: "Voce precisa passar o user_code.",
            })
            return false
         }
         if (isNaN(user_balance) === true) {
            res.send({
               status: "error",
               message: "User Balance deve ser um numero.",
            })
            return false
         }

         if ((await apifunctions.getagentbyagentToken(agentToken)).length === 0) {
            res.send({
               status: "error",
               message: "Agent Token não cadastrado.",
            })
            return false
         }
         if ((await apifunctions.getagentbysecretkey(secretKey)).length === 0) {
            res.send({
               status: "error",
               message: "Secret Key não cadastrado.",
            })
            return false
         }

         const agent = await apifunctions.getagentbyagentToken(agentToken)
         const user = await apifunctions.getuserbyagent(user_code, agent[0].id) //PUXA O USUARIO ATRAVES DO USER E AGENTID

         // Adicionando a lógica para enviar um request se o provider_code for 'PRAGMATIC'
         if (provider_code === "PRAGMATIC") {
            try {
               // Usa let para permitir reatribuição
               let user = await apifunctions.getuserbyagent(user_code, agent[0].id)

               // Criação do usuário se não existir
               if (user.length === 0) {
                  const tokenuser = v4()
                  const atkuser = v4()
                  const createnewuser = await apifunctions.createuser(user_code, tokenuser, atkuser, user_balance, agent[0].id)

                  if (createnewuser.affectedRows >= 1) {
                     // Obtendo o novo usuário após criação
                     user = await apifunctions.getuserbyagent(user_code, agent[0].id)
                  } else {
                     res.send({
                        status: 0,
                        msg: "ERRO",
                        message: "Erro ao criar o usuário.",
                     })
                     return
                  }
               }

               // Preparação dos dados da requisição para o Pragmatic
               const pragmaticRequestData = {
                  method: "game_launch",
                  agent_code: "admin",
                  agent_token: "admin",
                  user_code: user_code,
                  game_code: game_code,
                  lang: "pt",
                  provider_code: provider_code,
                  user_balance: user_balance,
               }

               // Envio da requisição para a API Pragmatic
               const pragmaticResponse = await axios.post("https://api.br777-pg.com/", pragmaticRequestData) // Substitua pela URL real

               // Responder com sucesso, incluindo o launch_url da resposta
               res.send({
                  status: 1,
                  msg: "SUCCESS",
                  launch_url: pragmaticResponse.data.launch_url || "",
                  user_code: user[0].username,
                  user_balance: user[0].saldo,
                  user_created: user.length === 0,
                  currency: "BRL",
               })
            } catch (error) {
               logger.error("Error sending request to Pragmatic:", error)
               res.send({
                  status: 0,
                  msg: "ERRO",
                  message: "Erro ao se conectar com o provedor PRAGMATIC."
               })
            }
            return
         }

         const game = gameByCode(game_code)
         if (!game || gameUnavailableReason(game.game_id)) {
            res.send({ status: "error", message: "Jogo indisponível." })
            return false
         }
         const codegame = game.game_id

         if (user.length === 0) {
            const tokenuser = v4()
            const atkuser = v4()
            const createnewuser = await apifunctions.createuser(user_code, tokenuser, atkuser, user_balance, agent[0].id)

            if (createnewuser.affectedRows >= 1) {
               const getnewuser = await apifunctions.getuserbyagent(user_code, agent[0].id)

               res.send({
                  status: 1,
                  msg: "SUCCESS",
                  launch_url: buildLaunchUrl(codegame, getnewuser[0].token),
                  user_code: getnewuser[0].username,
                  user_balance: getnewuser[0].saldo,
                  user_created: true,
                  currency: "BRL",
               })
            } else {
               res.send({
                  status: "error",
                  message: "Erro ao cadastrar o usuario.",
               })
               return false
            }
         } else {
            await apifunctions.setbalanceuserbyid(user[0].id, user_balance)

            res.send({
               status: 1,
               msg: "SUCCESS",
               launch_url: buildLaunchUrl(codegame, user[0].token),
               user_code: user[0].username,
               user_balance: user[0].saldo,
               user_created: false,
               currency: "BRL",
            })
         }
      } catch (error) {
         logger.error(error)
      }
   },
   async callbackgame(json: any) {
      const agent = await apifunctions.getagentbysecretkey(json.agent_secret)

      try {
         await axios({
            maxBodyLength: Infinity,
            method: "POST",
            url: `${agent[0].callbackurl}gold_api/game_callback`,
            timeout: 5000,
            headers: {
               "Content-Type": "application/json",
            },
            data: json,
         })
            .then((data) => {
               //console.log("NEW BALANCE" + data.data.user_balance)
            })
            .catch((error: any) => {
               console.log(error)
            })
      } catch (error) {
         console.log(error)
      }
   },
   async getagent(req: Request, res: Response) {
      const agentToken = req.body.agentToken
      const secretKey = req.body.secretKey

      if ((await apifunctions.getagentbyagentToken(agentToken)).length === 0) {
         res.send({
            status: "error",
            message: "Agent Token não cadastrado.",
         })
         return false
      }
      if ((await apifunctions.getagentbysecretkey(secretKey)).length === 0) {
         res.send({
            status: "error",
            message: "Secret Key não cadastrado.",
         })
         return false
      }
      const agent = await apifunctions.getagentbyagentToken(agentToken)
      agent[0].saldo = undefined
      agent[0].agentToken = undefined
      agent[0].saldo = undefined

      res.send(agent[0])
   },
   async attagent(req: Request, res: Response) {
      const agentToken = req.body.agentToken
      const secretKey = req.body.secretKey
      const probganho = req.body.probganho
      const probbonus = req.body.probbonus
      const probganhortp = req.body.probganhortp
      const probganhoinfluencer = req.body.probganhoinfluencer
      const probbonusinfluencer = req.body.probbonusinfluencer
      const probganhoaposta = req.body.probganhoaposta
      const probganhosaldo = req.body.probganhosaldo

      if ((await apifunctions.getagentbyagentToken(agentToken)).length === 0) {
         res.send({
            status: "error",
            message: "Agent Token não cadastrado.",
         })
         return false
      }
      if ((await apifunctions.getagentbysecretkey(secretKey)).length === 0) {
         res.send({
            status: "error",
            message: "Secret Key não cadastrado.",
         })
         return false
      }
      const agent = await apifunctions.getagentbyagentToken(agentToken)

      const att = await apifunctions.attagent(agent[0].id, probganho, probbonus, probganhortp, probganhoinfluencer, probbonusinfluencer, probganhoaposta, probganhosaldo)

      if (att.affectedRows > 0) {
         res.send({
            status: "success",
            message: "Probabiliades alteradas com sucesso.",
         })
      } else {
         res.send({
            status: "error",
            message: "Erro desconhecido por favor contate o adm.",
         })
      }
   },
}
