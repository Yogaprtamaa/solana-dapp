"use client"

import { useEffect, useState } from "react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import {
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  PublicKey,
  ParsedTransactionWithMeta,
} from "@solana/web3.js"

type ParsedTx = {
  signature: string
  amount: number
  type: "IN" | "OUT"
  time: string
}

export default function Home() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()

  const [balance, setBalance] = useState<number | null>(null)
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [txSig, setTxSig] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<ParsedTx[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Fetch balance
  useEffect(() => {
    const getBalance = async () => {
      if (!publicKey) return
      const bal = await connection.getBalance(publicKey)
      setBalance(bal / LAMPORTS_PER_SOL)
    }

    getBalance()
  }, [publicKey, connection, txSig])

  // Fetch & parse history
  useEffect(() => {
    const getHistory = async () => {
      if (!publicKey) return

      try {
        setLoadingHistory(true)

        const signatures = await connection.getSignaturesForAddress(
          publicKey,
          { limit: 5 }
        )

        const parsed: ParsedTx[] = []

        for (const sig of signatures) {
          const tx: ParsedTransactionWithMeta | null =
            await connection.getParsedTransaction(sig.signature)

          if (!tx || !tx.meta) continue

          const preBalance =
            tx.meta.preBalances[0] / LAMPORTS_PER_SOL
          const postBalance =
            tx.meta.postBalances[0] / LAMPORTS_PER_SOL

          const diff = postBalance - preBalance

          parsed.push({
            signature: sig.signature,
            amount: Math.abs(diff),
            type: diff > 0 ? "IN" : "OUT",
            time: sig.blockTime
              ? new Date(sig.blockTime * 1000).toLocaleString()
              : "Unknown",
          })
        }

        setHistory(parsed)
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingHistory(false)
      }
    }

    getHistory()
  }, [publicKey, connection, txSig])

  const sendSol = async () => {
    try {
      if (!publicKey) return setError("Connect wallet dulu.")

      let toPubkey: PublicKey
      try {
        toPubkey = new PublicKey(recipient.trim())
      } catch {
        return setError("Recipient address tidak valid.")
      }

      if (!amount || parseFloat(amount) <= 0)
        return setError("Amount tidak valid.")

      setLoading(true)
      setError(null)
      setTxSig(null)

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: toPubkey,
          lamports: parseFloat(amount) * LAMPORTS_PER_SOL,
        })
      )

      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, "processed")

      setTxSig(signature)
      setRecipient("")
      setAmount("")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-purple-900 text-white p-6">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-6 space-y-6">

        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">Solana Wallet</h1>
          <WalletMultiButton />
        </div>

        {!publicKey && (
          <div className="text-center text-sm opacity-70">
            Connect wallet untuk mulai.
          </div>
        )}

        {publicKey && (
          <>
            <div className="bg-white/5 p-4 rounded-xl space-y-2 text-sm">
              <p className="opacity-70">Balance</p>
              <p className="font-semibold text-lg">
                {balance ?? "Loading..."} SOL
              </p>
            </div>

            {/* SEND */}
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Recipient Address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm outline-none"
              />

              <input
                type="number"
                placeholder="Amount (SOL)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm outline-none"
              />

              <button
                onClick={sendSol}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 transition rounded-xl p-3 font-semibold disabled:opacity-50"
              >
                {loading ? "Processing..." : "Send SOL"}
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-sm text-red-400">
                {error}
              </div>
            )}

            {/* HISTORY */}
            <div className="bg-white/5 p-4 rounded-xl space-y-3 text-sm">
              <h2 className="font-semibold">Recent Activity</h2>

              {loadingHistory && <p>Loading...</p>}

              {!loadingHistory &&
                history.map((tx) => (
                  <div
                    key={tx.signature}
                    className="flex justify-between items-center bg-white/10 p-3 rounded-lg"
                  >
                    <div>
                      <p className="text-xs opacity-70">{tx.time}</p>
                      <p
                        className={`font-semibold ${
                          tx.type === "IN"
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {tx.type === "IN" ? "+" : "-"} {tx.amount} SOL
                      </p>
                    </div>

                    <a
                      href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                      target="_blank"
                      className="text-xs underline opacity-70"
                    >
                      View
                    </a>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}