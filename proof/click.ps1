# Presses a button of the running app by its name, the way a screen reader would.
param([string]$Name, [int]$Seconds = 60, [string]$Shot = "", [switch]$Look)
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms, System.Drawing
$auto = [System.Windows.Automation.AutomationElement]
$scope = [System.Windows.Automation.TreeScope]
$until = (Get-Date).AddSeconds($Seconds)
while ((Get-Date) -lt $until) {
  $window = $null
  foreach ($p in Get-Process lokus-desktop -ErrorAction SilentlyContinue) {
    $w = $auto::RootElement.FindFirst($scope::Children, (New-Object System.Windows.Automation.PropertyCondition($auto::ProcessIdProperty, $p.Id)))
    if ($w) { $window = $w }
  }
  if ($window) {
    $button = $window.FindFirst($scope::Descendants, (New-Object System.Windows.Automation.PropertyCondition($auto::NameProperty, $Name)))
    if ($button) {
      if ($Shot) {
        $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
        [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen(0, 0, 0, 0, $bmp.Size)
        $bmp.Save($Shot)
      }
      if (-not $Look) {
        $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        Write-Output "pressed '$Name' ($($button.Current.ControlType.ProgrammaticName))"
      }
      exit 0
    }
  }
  Start-Sleep -Milliseconds 700
}
if ($window) {
  $all = $window.FindAll($scope::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  Write-Output ("on screen: " + (($all | ForEach-Object { $_.Current.Name } | Where-Object { $_ } | Select-Object -First 60) -join " | "))
} else { Write-Output "no Lokus window" }
exit 1
