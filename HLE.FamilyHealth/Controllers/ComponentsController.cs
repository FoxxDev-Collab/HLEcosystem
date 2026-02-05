using Microsoft.AspNetCore.Mvc;

namespace HLE.FamilyHealth.Controllers;

public class ComponentsController : Controller
{
    public IActionResult Index()
    {
        return View();
    }

    public IActionResult Demo()
    {
        return View();
    }
}
