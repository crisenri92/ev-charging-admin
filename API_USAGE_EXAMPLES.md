# 💻 Ejemplos Prácticos de Uso - API de Pagos

Ejemplos completos listos para copiar y usar en tu frontend.

---

## 🔧 Setup Inicial

```typescript
// lib/api-client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = localStorage.getItem('supabase-token'); // O tu método de auth
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  return await response.json();
}
```

---

## 📱 Ejemplo 1: Recarga de Wallet con Deuna

### Frontend Component

```typescript
'use client';
import { useState } from 'react';
import { apiCall } from '@/lib/api-client';

export default function WalletRecharge() {
  const [amount, setAmount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [qrData, setQRData] = useState<any>(null);

  const handleRecharge = async () => {
    setLoading(true);
    try {
      // 1. Crear pago
      const response = await apiCall('/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'deuna',
          context: 'wallet_recharge',
          amount,
          expirationMinutes: 30,
        }),
      });

      if (response.success) {
        setQRData(response.payment);
        
        // 2. Iniciar polling
        pollPaymentStatus(response.payment.paymentId);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = (paymentId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await apiCall(`/api/payments/status/${paymentId}`);
        
        if (status.status === 'approved') {
          clearInterval(interval);
          alert('✅ Pago confirmado! Tu saldo fue actualizado.');
          setQRData(null);
          // Recargar balance
          window.location.reload();
        } else if (status.status === 'expired' || status.status === 'failed') {
          clearInterval(interval);
          alert('❌ El pago expiró o falló.');
          setQRData(null);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000); // Cada 3 segundos

    // Timeout después de 30 minutos
    setTimeout(() => clearInterval(interval), 30 * 60 * 1000);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Recargar Wallet</h2>

      {!qrData ? (
        <div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value))}
            className="border p-2 rounded"
            min="1"
          />
          <button
            onClick={handleRecharge}
            disabled={loading}
            className="ml-2 bg-green-600 text-white px-4 py-2 rounded"
          >
            {loading ? 'Procesando...' : `Recargar $${amount}`}
          </button>
        </div>
      ) : (
        <div className="border p-4 rounded">
          <h3 className="font-bold mb-2">Escanea el QR para pagar</h3>
          
          {/* Mostrar QR */}
          <div 
            dangerouslySetInnerHTML={{ __html: qrData.qrCode }} 
            className="mb-4"
          />
          
          {/* Link alternativo */}
          <p className="mb-2">O usa este link:</p>
          <a 
            href={qrData.deeplink} 
            target="_blank"
            className="text-blue-600 underline"
          >
            Pagar con Deuna
          </a>
          
          {/* Código numérico */}
          {qrData.numericCode && (
            <div className="mt-4">
              <p className="mb-1">O ingresa el código en la app Deuna:</p>
              <p className="text-2xl font-mono font-bold">{qrData.numericCode}</p>
            </div>
          )}
          
          <p className="text-sm text-gray-500 mt-4">
            Expira en: {new Date(qrData.expiresAt).toLocaleString()}
          </p>
          
          <button
            onClick={() => setQRData(null)}
            className="mt-4 text-red-600"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## ⚡ Ejemplo 2: Pago Directo de Carga con Deuna

### Frontend Component

```typescript
'use client';
import { useState } from 'react';
import { apiCall } from '@/lib/api-client';

interface ChargerPaymentProps {
  chargerId: string;
  chargerName: string;
}

export default function ChargerPayment({ chargerId, chargerName }: ChargerPaymentProps) {
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [authorized, setAuthorized] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      // 1. Iniciar proceso de carga con pago
      const response = await apiCall('/api/charging/initiate', {
        method: 'POST',
        body: JSON.stringify({
          chargerId,
          provider: 'deuna',
          estimatedKwh: 10,
        }),
      });

      if (response.authorized) {
        // Wallet: Ya autorizado
        setAuthorized(true);
        startCharging();
      } else {
        // Deuna: Mostrar QR
        setPaymentData(response);
        pollPaymentStatus(response.payment.paymentId);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = (paymentId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await apiCall(`/api/payments/status/${paymentId}`);
        
        if (status.status === 'approved') {
          clearInterval(interval);
          setAuthorized(true);
          startCharging();
        } else if (status.status === 'expired' || status.status === 'failed') {
          clearInterval(interval);
          alert('❌ El pago expiró o falló.');
          setPaymentData(null);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);

    // Timeout después de 10 minutos
    setTimeout(() => clearInterval(interval), 10 * 60 * 1000);
  };

  const startCharging = async () => {
    try {
      const response = await apiCall('/api/charging/start', {
        method: 'POST',
        body: JSON.stringify({ chargerId }),
      });

      alert(`✅ Carga iniciada! Sesión: ${response.sessionId}`);
      // Redirigir a pantalla de carga activa
      window.location.href = `/charging/${chargerId}/active`;
    } catch (error: any) {
      alert(`Error al iniciar carga: ${error.message}`);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Pagar Carga</h2>
      <p className="mb-4">Cargador: {chargerName}</p>

      {!paymentData && !authorized && (
        <button
          onClick={handlePayment}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg"
        >
          {loading ? 'Procesando...' : 'Iniciar Carga con Deuna'}
        </button>
      )}

      {paymentData && !authorized && (
        <div className="border p-4 rounded">
          <h3 className="font-bold mb-2">Paga ${paymentData.pricing.estimatedAmount}</h3>
          <p className="text-sm text-gray-600 mb-4">
            ~{paymentData.pricing.estimatedKwh} kWh × ${paymentData.pricing.pricePerKwh}/kWh
          </p>
          
          {/* QR Code */}
          <div 
            dangerouslySetInnerHTML={{ __html: paymentData.payment.qrCode }} 
            className="mb-4"
          />
          
          {/* Link */}
          <a 
            href={paymentData.payment.deeplink} 
            target="_blank"
            className="block text-blue-600 underline mb-4"
          >
            Abrir en app Deuna
          </a>
          
          {/* Código */}
          {paymentData.payment.numericCode && (
            <div className="bg-gray-100 p-3 rounded">
              <p className="text-sm mb-1">Código:</p>
              <p className="text-3xl font-mono font-bold">
                {paymentData.payment.numericCode}
              </p>
            </div>
          )}
          
          <p className="text-xs text-gray-500 mt-4">
            ⏱ Esperando confirmación de pago...
          </p>
        </div>
      )}

      {authorized && (
        <div className="bg-green-100 border border-green-600 p-4 rounded">
          <p className="text-green-800 font-bold">
            ✅ Pago confirmado! Iniciando carga...
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 💳 Ejemplo 3: Pago con Wallet (Instantáneo)

```typescript
'use client';
import { useState } from 'react';
import { apiCall } from '@/lib/api-client';

export default function WalletPayment({ chargerId }: { chargerId: string }) {
  const [loading, setLoading] = useState(false);

  const handleWalletPayment = async () => {
    setLoading(true);
    try {
      // 1. Iniciar con wallet (autoriza inmediato)
      const response = await apiCall('/api/charging/initiate', {
        method: 'POST',
        body: JSON.stringify({
          chargerId,
          provider: 'wallet',
          estimatedKwh: 10,
        }),
      });

      if (response.authorized) {
        // 2. Iniciar carga inmediatamente
        const startResponse = await apiCall('/api/charging/start', {
          method: 'POST',
          body: JSON.stringify({ chargerId }),
        });

        alert(`✅ Carga iniciada con wallet! Sesión: ${startResponse.sessionId}`);
        window.location.href = `/charging/${chargerId}/active`;
      }
    } catch (error: any) {
      if (error.message.includes('insufficient_balance')) {
        alert('❌ Saldo insuficiente. Por favor recarga tu wallet.');
        window.location.href = '/wallet';
      } else {
        alert(`Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleWalletPayment}
      disabled={loading}
      className="bg-purple-600 text-white px-6 py-3 rounded-lg"
    >
      {loading ? 'Procesando...' : 'Pagar con Wallet'}
    </button>
  );
}
```

---

## 🔄 Ejemplo 4: Selector de Método de Pago

```typescript
'use client';
import { useState } from 'react';
import ChargerPayment from './ChargerPayment';
import WalletPayment from './WalletPayment';

interface PaymentMethodSelectorProps {
  chargerId: string;
  chargerName: string;
  userBalance: number;
}

export default function PaymentMethodSelector({
  chargerId,
  chargerName,
  userBalance,
}: PaymentMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<'deuna' | 'wallet' | null>(null);

  if (selectedMethod === 'deuna') {
    return <ChargerPayment chargerId={chargerId} chargerName={chargerName} />;
  }

  if (selectedMethod === 'wallet') {
    return <WalletPayment chargerId={chargerId} />;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Selecciona método de pago</h2>
      <p className="mb-4 text-gray-600">Cargador: {chargerName}</p>

      <div className="grid grid-cols-2 gap-4">
        {/* Deuna */}
        <button
          onClick={() => setSelectedMethod('deuna')}
          className="border-2 border-green-600 rounded-lg p-4 hover:bg-green-50"
        >
          <div className="text-4xl mb-2">🇪🇨</div>
          <p className="font-bold">Deuna</p>
          <p className="text-sm text-gray-600">Banca Móvil</p>
        </button>

        {/* Wallet */}
        <button
          onClick={() => setSelectedMethod('wallet')}
          className="border-2 border-purple-600 rounded-lg p-4 hover:bg-purple-50"
        >
          <div className="text-4xl mb-2">💳</div>
          <p className="font-bold">Wallet</p>
          <p className="text-sm text-gray-600">
            Saldo: ${userBalance.toFixed(2)}
          </p>
        </button>
      </div>

      {userBalance < 5 && (
        <div className="mt-4 bg-yellow-100 border border-yellow-600 p-3 rounded">
          <p className="text-sm text-yellow-800">
            ⚠️ Saldo bajo. Considera recargar tu wallet.
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 🧪 Ejemplo 5: Testing con Jest

```typescript
// __tests__/payment-api.test.ts
import { apiCall } from '@/lib/api-client';

describe('Payment API', () => {
  beforeEach(() => {
    // Mock localStorage
    global.localStorage = {
      getItem: jest.fn(() => 'mock-token'),
    } as any;
  });

  it('should create payment successfully', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          payment: {
            id: 'uuid',
            paymentId: 'deuna-123',
            qrCode: '<svg>...</svg>',
          },
        }),
      })
    ) as any;

    const response = await apiCall('/api/payments/create', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'deuna',
        context: 'wallet_recharge',
        amount: 20,
      }),
    });

    expect(response.success).toBe(true);
    expect(response.payment.qrCode).toBeDefined();
  });

  it('should handle errors', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({ error: 'Invalid provider' }),
      })
    ) as any;

    await expect(
      apiCall('/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ provider: 'invalid' }),
      })
    ).rejects.toThrow('Invalid provider');
  });
});
```

---

## 📊 Ejemplo 6: Hook Personalizado

```typescript
// hooks/usePayment.ts
import { useState } from 'react';
import { apiCall } from '@/lib/api-client';

export function usePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<any>(null);

  const createPayment = async (
    provider: string,
    context: string,
    amount: number
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall('/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ provider, context, amount }),
      });

      setPaymentData(response.payment);
      return response.payment;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (paymentId: string) => {
    try {
      const response = await apiCall(`/api/payments/status/${paymentId}`);
      return response;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const pollStatus = (
    paymentId: string,
    onApproved: () => void,
    onFailed: () => void
  ) => {
    const interval = setInterval(async () => {
      try {
        const status = await checkStatus(paymentId);

        if (status.status === 'approved') {
          clearInterval(interval);
          onApproved();
        } else if (status.status === 'expired' || status.status === 'failed') {
          clearInterval(interval);
          onFailed();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  };

  return {
    loading,
    error,
    paymentData,
    createPayment,
    checkStatus,
    pollStatus,
  };
}

// Uso:
function MyComponent() {
  const { createPayment, pollStatus } = usePayment();

  const handleRecharge = async () => {
    const payment = await createPayment('deuna', 'wallet_recharge', 20);
    
    pollStatus(
      payment.paymentId,
      () => alert('¡Pago aprobado!'),
      () => alert('Pago falló')
    );
  };

  return <button onClick={handleRecharge}>Recargar</button>;
}
```

---

## 🎨 Ejemplo 7: Modal de QR Reutilizable

```typescript
// components/QRPaymentModal.tsx
interface QRPaymentModalProps {
  payment: {
    qrCode: string;
    deeplink: string;
    numericCode?: string;
    amount: number;
    expiresAt: string;
  };
  onClose: () => void;
}

export default function QRPaymentModal({ payment, onClose }: QRPaymentModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Pagar ${payment.amount}</h2>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>

        {/* QR Code */}
        <div 
          dangerouslySetInnerHTML={{ __html: payment.qrCode }}
          className="flex justify-center mb-4"
        />

        {/* Instructions */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold mb-1">Opción 1: Escanea el QR</p>
            <p className="text-xs text-gray-600">Con tu app de banca móvil o Deuna</p>
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">Opción 2: Usa el link</p>
            <a 
              href={payment.deeplink}
              target="_blank"
              className="text-xs text-blue-600 underline break-all"
            >
              {payment.deeplink}
            </a>
          </div>

          {payment.numericCode && (
            <div>
              <p className="text-sm font-semibold mb-1">Opción 3: Ingresa el código</p>
              <div className="bg-gray-100 p-3 rounded text-center">
                <p className="text-3xl font-mono font-bold">{payment.numericCode}</p>
              </div>
            </div>
          )}
        </div>

        {/* Timer */}
        <p className="text-xs text-gray-500 mt-4 text-center">
          Expira: {new Date(payment.expiresAt).toLocaleTimeString()}
        </p>

        {/* Loading indicator */}
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
          <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
          Esperando confirmación...
        </div>
      </div>
    </div>
  );
}
```

---

¡Todos estos ejemplos están listos para copiar y usar! 🎉
