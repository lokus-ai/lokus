// Network monitoring and bandwidth control for enterprise sync

use std::sync::{Arc, atomic::{AtomicU64, AtomicBool, Ordering}};
use std::time::{Duration, Instant};
use tokio::time::interval;
use sysinfo::System;
use tokio::sync::Semaphore;

pub struct NetworkMonitor {
    system: System,
    last_check: Instant,
    last_bytes: u64,
    bandwidth_bps: Arc<AtomicU64>,
    is_online: Arc<AtomicBool>,
}

impl NetworkMonitor {
    pub fn new() -> Self {
        let system = System::new();
        
        Self {
            system,
            last_check: Instant::now(),
            last_bytes: 0,
            bandwidth_bps: Arc::new(AtomicU64::new(0)),
            is_online: Arc::new(AtomicBool::new(true)),
        }
    }
    
    pub async fn start_monitoring(self: Arc<Self>) {
        let mut interval = interval(Duration::from_secs(1));
        
        tokio::spawn(async move {
            loop {
                interval.tick().await;
                self.clone().update_metrics();
            }
        });
    }
    
    fn update_metrics(self: Arc<Self>) {
        // For now, just do a simple online check
        // TODO: Implement proper network monitoring when sysinfo API stabilizes
        let is_online = true; // Assume online for now
        self.is_online.store(is_online, Ordering::Relaxed);
        
        // Placeholder bandwidth - can implement actual monitoring later
        self.bandwidth_bps.store(10_000_000, Ordering::Relaxed); // 10 Mbps default
    }
    
    pub fn get_bandwidth_bps(&self) -> u64 {
        self.bandwidth_bps.load(Ordering::Relaxed)
    }
    
    pub fn is_online(&self) -> bool {
        self.is_online.load(Ordering::Relaxed)
    }
}

pub struct BandwidthLimiter {
    limit_bps: Option<u64>,
    semaphore: Arc<Semaphore>,
    chunk_size: usize,
}

impl BandwidthLimiter {
    pub fn new(limit_mbps: Option<f64>, chunk_size: usize) -> Self {
        let limit_bps = limit_mbps.map(|mbps| (mbps * 1_000_000.0 / 8.0) as u64);
        
        // Calculate how many chunks per second we can send
        let permits = if let Some(bps) = limit_bps {
            std::cmp::max(1, (bps as usize) / chunk_size)
        } else {
            1000 // Effectively unlimited
        };
        
        Self {
            limit_bps,
            semaphore: Arc::new(Semaphore::new(permits)),
            chunk_size,
        }
    }
    
    pub async fn acquire(&self) -> Result<(), String> {
        if self.limit_bps.is_some() {
            self.semaphore.acquire().await
                .map_err(|e| format!("Failed to acquire bandwidth permit: {}", e))?
                .forget(); // We'll replenish permits periodically
        }
        Ok(())
    }
    
    pub async fn start_replenisher(self: Arc<Self>) {
        if let Some(bps) = self.limit_bps {
            let permits_per_second = std::cmp::max(1, (bps as usize) / self.chunk_size);
            let mut interval = interval(Duration::from_secs(1));
            
            tokio::spawn(async move {
                loop {
                    interval.tick().await;
                    // Replenish permits up to the limit
                    let current = self.semaphore.available_permits();
                    if current < permits_per_second {
                        self.semaphore.add_permits(permits_per_second - current);
                    }
                }
            });
        }
    }
}